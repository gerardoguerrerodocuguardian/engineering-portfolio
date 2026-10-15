locals {
  https         = var.certificate_arn != null
  listener_port = local.https ? 443 : 80
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  count = var.restrict_to_cloudfront ? 1 : 0

  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "this" {
  name_prefix = "${var.name}-alb-"
  description = "ALB: only CloudFront in, only the VPC out"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-alb" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "from_cloudfront" {
  count = var.restrict_to_cloudfront ? 1 : 0

  security_group_id = aws_security_group.this.id
  description       = "CloudFront origin-facing prefix list"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront[0].id
  ip_protocol       = "tcp"
  from_port         = local.listener_port
  to_port           = local.listener_port
}

resource "aws_vpc_security_group_ingress_rule" "open" {
  count = var.restrict_to_cloudfront ? 0 : 1

  security_group_id = aws_security_group.this.id
  description       = "Unrestricted (set restrict_to_cloudfront = true outside sandboxes)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = local.listener_port
  to_port           = local.listener_port
}

resource "aws_vpc_security_group_egress_rule" "to_targets" {
  security_group_id = aws_security_group.this.id
  description       = "To targets inside the VPC"
  cidr_ipv4         = var.vpc_cidr
  ip_protocol       = "tcp"
  from_port         = var.container_port
  to_port           = var.container_port
}

resource "aws_lb" "this" {
  name                       = var.name
  load_balancer_type         = "application"
  internal                   = false
  subnets                    = var.public_subnet_ids
  security_groups            = [aws_security_group.this.id]
  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection
  idle_timeout               = 60

  tags = merge(var.tags, { Name = var.name })
}

resource "aws_lb_target_group" "this" {
  name_prefix          = "tg-"
  vpc_id               = var.vpc_id
  port                 = var.container_port
  protocol             = "HTTP"
  target_type          = "ip" # required for Fargate (awsvpc)
  deregistration_delay = 30

  health_check {
    path                = var.health_check_path
    matcher             = "200-299"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, { Name = var.name })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_listener" "this" {
  load_balancer_arn = aws_lb.this.arn
  port              = local.listener_port
  protocol          = local.https ? "HTTPS" : "HTTP"
  ssl_policy        = local.https ? "ELBSecurityPolicy-TLS13-1-2-2021-06" : null
  certificate_arn   = var.certificate_arn

  # Default: refuse. Only requests carrying the CloudFront secret are forwarded.
  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }

  tags = var.tags
}

resource "aws_lb_listener_rule" "from_cloudfront" {
  listener_arn = aws_lb_listener.this.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }

  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [var.origin_verify_secret]
    }
  }

  tags = var.tags
}
