data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project}-prod"
  azs  = slice(data.aws_availability_zones.available.names, 0, 3)
}

# ---- Network ---------------------------------------------------------------------

module "vpc" {
  source = "../../modules/vpc"

  name                       = local.name
  cidr                       = "10.30.0.0/16"
  azs                        = local.azs
  single_nat_gateway         = false
  enable_interface_endpoints = true
}

# ---- Secrets -----------------------------------------------------------------------

# Shared secret proving a request came through CloudFront (see docs/adr/0002).
resource "random_password" "origin_verify" {
  length  = 40
  special = false
}

module "secrets" {
  source = "../../modules/secrets"

  name                    = local.name
  recovery_window_in_days = 30

  secrets = {
    "app-signing-key" = { description = "Application signing key (generated)" }
  }
}

# ---- Data stores ---------------------------------------------------------------------

module "progress_table" {
  source = "../../modules/dynamodb"

  name                = "${local.name}-progress"
  hash_key            = "user_id"
  range_key           = "course_id"
  deletion_protection = true

  attributes = [
    { name = "user_id", type = "S" },
    { name = "course_id", type = "S" },
  ]
}

module "db" {
  source = "../../modules/rds-postgres"

  name                       = local.name
  vpc_id                     = module.vpc.vpc_id
  subnet_ids                 = module.vpc.data_subnet_ids
  allowed_security_group_ids = [module.api.security_group_id]
  instance_class             = "db.m6g.large"
  multi_az                   = true
  backup_retention_days      = 14
  deletion_protection        = true
  skip_final_snapshot        = false
}

# ---- Identity --------------------------------------------------------------------------

module "auth" {
  source = "../../modules/cognito-user-pool"

  name                = local.name
  domain_prefix       = var.cognito_domain_prefix
  deletion_protection = true
  callback_urls       = ["https://${var.site_aliases[0]}/callback"]
  logout_urls         = ["https://${var.site_aliases[0]}/"]
}

# ---- Edge and compute ----------------------------------------------------------------------

resource "aws_ecr_repository" "api" {
  name                 = "${local.name}-api"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

module "alb" {
  source = "../../modules/alb"

  name                 = local.name
  vpc_id               = module.vpc.vpc_id
  vpc_cidr             = module.vpc.vpc_cidr
  public_subnet_ids    = module.vpc.public_subnet_ids
  container_port       = 8080
  certificate_arn      = var.alb_certificate_arn
  origin_verify_secret = random_password.origin_verify.result
  deletion_protection  = true
}

module "api" {
  source = "../../modules/ecs-fargate-service"

  name                  = "${local.name}-api"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.target_group_arn
  image                 = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
  container_port        = 8080
  cpu                   = 512
  memory                = 1024
  desired_count         = 3
  min_capacity          = 3
  max_capacity          = 12

  enable_container_insights = true
  log_retention_days        = 90

  environment = {
    COGNITO_ISSUER    = module.auth.issuer_url
    COGNITO_CLIENT_ID = module.auth.client_id
    PROGRESS_TABLE    = module.progress_table.table_name
    DB_HOST           = module.db.address
    DB_PORT           = tostring(module.db.port)
    DB_NAME           = module.db.database_name
  }

  # Injected by ECS at launch from Secrets Manager; never in the task definition.
  secrets = {
    DB_USER         = "${module.db.master_secret_arn}:username::"
    DB_PASSWORD     = "${module.db.master_secret_arn}:password::"
    APP_SIGNING_KEY = module.secrets.secret_arns["app-signing-key"]
  }
  secret_arns         = [module.db.master_secret_arn, module.secrets.secret_arns["app-signing-key"]]
  secret_kms_key_arns = [module.db.kms_key_arn, module.secrets.kms_key_arn]

  attach_task_policy = true
  task_policy_json   = module.progress_table.access_policy_json

  extra_egress = [
    {
      port        = 5432
      cidr_blocks = module.vpc.data_subnet_cidrs
      description = "PostgreSQL in data subnets"
    },
  ]
}

module "site" {
  source = "../../modules/cloudfront-s3-static-site"

  name                 = local.name
  bucket_name          = "${local.name}-site-${var.site_bucket_suffix}"
  force_destroy        = false
  api_origin_domain    = var.api_origin_domain
  api_origin_https     = true
  origin_verify_secret = random_password.origin_verify.result
  price_class          = "PriceClass_200"
  aliases              = var.site_aliases
  acm_certificate_arn  = var.cloudfront_certificate_arn
}

# ---- CI/CD identity (no static keys) ----------------------------------------------------------

module "github_oidc" {
  source = "../../modules/iam-github-oidc"

  name_prefix       = local.name
  github_repository = var.github_repository
  plan_subjects     = ["pull_request"]
  apply_subjects    = ["environment:prod"]
  state_bucket_arn  = var.state_bucket_arn
  lock_table_arn    = var.lock_table_arn
  # apply_policy_json: attach a policy scoped to the services above before enabling apply in CI.
}
