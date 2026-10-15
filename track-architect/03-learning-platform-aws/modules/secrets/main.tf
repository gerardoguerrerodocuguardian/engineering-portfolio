resource "aws_kms_key" "this" {
  description             = "${var.name} Secrets Manager encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 7

  tags = var.tags
}

resource "aws_kms_alias" "this" {
  name          = "alias/${var.name}-secrets"
  target_key_id = aws_kms_key.this.key_id
}

resource "aws_secretsmanager_secret" "this" {
  for_each = var.secrets

  name                    = "${var.name}/${each.key}"
  description             = each.value.description
  kms_key_id              = aws_kms_key.this.arn
  recovery_window_in_days = var.recovery_window_in_days

  tags = var.tags
}

resource "random_password" "this" {
  for_each = { for k, v in var.secrets : k => v if v.generate }

  length  = each.value.length
  special = false
}

# Generated values land in Terraform state (encrypted S3 backend, restricted access).
# For high-value secrets prefer generate = false and set the value out-of-band.
resource "aws_secretsmanager_secret_version" "generated" {
  for_each = random_password.this

  secret_id     = aws_secretsmanager_secret.this[each.key].id
  secret_string = each.value.result
}
