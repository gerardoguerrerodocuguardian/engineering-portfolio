output "vpc_id" {
  description = "VPC id."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "VPC CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet ids (ALB, NAT)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet ids (ECS tasks)."
  value       = aws_subnet.private[*].id
}

output "data_subnet_ids" {
  description = "Isolated data subnet ids (RDS)."
  value       = aws_subnet.data[*].id
}

output "data_subnet_cidrs" {
  description = "CIDR blocks of the data subnets."
  value       = aws_subnet.data[*].cidr_block
}
