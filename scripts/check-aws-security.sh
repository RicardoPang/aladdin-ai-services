#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔐 AWS Aurora 安全组配置检查${NC}"
echo "========================================"

# 检查AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI 未安装${NC}"
    echo -e "${YELLOW}💡 安装命令: brew install awscli${NC}"
    exit 1
fi

# 检查AWS凭证
echo -e "${BLUE}🔑 检查AWS凭证...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS凭证未配置或已过期${NC}"
    echo -e "${YELLOW}💡 配置命令: aws configure${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS凭证验证成功${NC}"

# 从.env.production读取数据库配置
ENV_FILE="../.env.production"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ .env.production 文件不存在${NC}"
    exit 1
fi

# 提取数据库主机名
WRITER_HOST=$(grep "^DATABASE_URL=" "$ENV_FILE" | sed 's/DATABASE_URL="postgresql:\/\/[^:]*:[^@]*@\([^:]*\):.*/\1/' | tr -d '"')
READER_HOST=$(grep "^DATABASE_URL_READER=" "$ENV_FILE" | sed 's/DATABASE_URL_READER="postgresql:\/\/[^:]*:[^@]*@\([^:]*\):.*/\1/' | tr -d '"')

echo -e "${PURPLE}📋 数据库配置:${NC}"
echo "写库主机: $WRITER_HOST"
echo "读库主机: $READER_HOST"

# 提取集群信息
CLUSTER_NAME=$(echo "$WRITER_HOST" | cut -d'.' -f1)
AWS_REGION=$(echo "$WRITER_HOST" | cut -d'.' -f3)

echo "集群名称: $CLUSTER_NAME"
echo "AWS区域: $AWS_REGION"

# 获取RDS集群信息
echo -e "\n${BLUE}🔍 获取RDS集群信息...${NC}"
CLUSTER_INFO=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$CLUSTER_NAME" \
    --region "$AWS_REGION" \
    --output json 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 无法获取RDS集群信息${NC}"
    echo -e "${YELLOW}💡 请检查集群名称和区域是否正确${NC}"
    exit 1
fi

echo -e "${GREEN}✅ RDS集群信息获取成功${NC}"

# 解析集群状态
CLUSTER_STATUS=$(echo "$CLUSTER_INFO" | jq -r '.DBClusters[0].Status')
VPC_ID=$(echo "$CLUSTER_INFO" | jq -r '.DBClusters[0].DBSubnetGroup.VpcId')
SECURITY_GROUPS=$(echo "$CLUSTER_INFO" | jq -r '.DBClusters[0].VpcSecurityGroups[].VpcSecurityGroupId' | tr '\n' ' ')

echo -e "\n${PURPLE}📊 集群状态:${NC}"
echo "状态: $CLUSTER_STATUS"
echo "VPC ID: $VPC_ID"
echo "安全组: $SECURITY_GROUPS"

# 检查每个安全组的规则
echo -e "\n${BLUE}🛡️  检查安全组规则...${NC}"

for SG_ID in $SECURITY_GROUPS; do
    echo -e "\n${CYAN}安全组: $SG_ID${NC}"
    
    # 获取安全组详情
    SG_INFO=$(aws ec2 describe-security-groups \
        --group-ids "$SG_ID" \
        --region "$AWS_REGION" \
        --output json 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 无法获取安全组 $SG_ID 信息${NC}"
        continue
    fi
    
    SG_NAME=$(echo "$SG_INFO" | jq -r '.SecurityGroups[0].GroupName')
    echo "名称: $SG_NAME"
    
    # 检查入站规则
    echo -e "${YELLOW}入站规则:${NC}"
    INBOUND_RULES=$(echo "$SG_INFO" | jq -r '.SecurityGroups[0].IpPermissions[]')
    
    # 检查是否有PostgreSQL端口规则
    POSTGRES_RULES=$(echo "$SG_INFO" | jq '.SecurityGroups[0].IpPermissions[] | select(.FromPort == 5432 or .ToPort == 5432)')
    
    if [ "$POSTGRES_RULES" == "" ]; then
        echo -e "${RED}❌ 未找到PostgreSQL端口(5432)的入站规则${NC}"
    else
        echo -e "${GREEN}✅ 找到PostgreSQL端口规则:${NC}"
        echo "$POSTGRES_RULES" | jq -r '. | "  端口: \(.FromPort)-\(.ToPort), 协议: \(.IpProtocol)"'
        
        # 检查源IP范围
        SOURCES=$(echo "$POSTGRES_RULES" | jq -r '.IpRanges[]?.CidrIp // .UserIdGroupPairs[]?.GroupId // "N/A"')
        echo "  允许来源: $SOURCES"
        
        # 检查是否允许所有IP
        if echo "$SOURCES" | grep -q "0.0.0.0/0"; then
            echo -e "${YELLOW}⚠️  警告: 允许所有IP访问，存在安全风险${NC}"
        fi
    fi
    
    # 检查出站规则
    echo -e "${YELLOW}出站规则:${NC}"
    OUTBOUND_RULES=$(echo "$SG_INFO" | jq -r '.SecurityGroups[0].IpPermissionsEgress[] | "  端口: \(.FromPort // "All")-\(.ToPort // "All"), 协议: \(.IpProtocol)"')
    echo "$OUTBOUND_RULES"
done

# 获取子网信息
echo -e "\n${BLUE}🌐 检查子网配置...${NC}"
SUBNET_GROUP=$(echo "$CLUSTER_INFO" | jq -r '.DBClusters[0].DBSubnetGroup.DBSubnetGroupName')
SUBNETS=$(aws rds describe-db-subnet-groups \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --region "$AWS_REGION" \
    --output json | jq -r '.DBSubnetGroups[0].Subnets[].SubnetIdentifier' | tr '\n' ' ')

echo "子网组: $SUBNET_GROUP"
echo "子网: $SUBNETS"

for SUBNET_ID in $SUBNETS; do
    SUBNET_INFO=$(aws ec2 describe-subnets \
        --subnet-ids "$SUBNET_ID" \
        --region "$AWS_REGION" \
        --output json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        AZ=$(echo "$SUBNET_INFO" | jq -r '.Subnets[0].AvailabilityZone')
        CIDR=$(echo "$SUBNET_INFO" | jq -r '.Subnets[0].CidrBlock')
        echo "  $SUBNET_ID: $AZ ($CIDR)"
    fi
done

# 检查网络ACL
echo -e "\n${BLUE}📋 检查网络ACL...${NC}"
for SUBNET_ID in $SUBNETS; do
    ACL_ID=$(aws ec2 describe-network-acls \
        --filters "Name=association.subnet-id,Values=$SUBNET_ID" \
        --region "$AWS_REGION" \
        --output json | jq -r '.NetworkAcls[0].NetworkAclId')
    
    if [ "$ACL_ID" != "null" ]; then
        echo "子网 $SUBNET_ID 关联的网络ACL: $ACL_ID"
        
        # 检查ACL规则
        ACL_RULES=$(aws ec2 describe-network-acls \
            --network-acl-ids "$ACL_ID" \
            --region "$AWS_REGION" \
            --output json | jq -r '.NetworkAcls[0].Entries[] | select(.PortRange.From == 5432 or .PortRange.To == 5432) | "  规则 \(.RuleNumber): \(.RuleAction) \(.CidrBlock) 端口 \(.PortRange.From)-\(.PortRange.To)"')
        
        if [ "$ACL_RULES" != "" ]; then
            echo -e "${GREEN}PostgreSQL相关ACL规则:${NC}"
            echo "$ACL_RULES"
        else
            echo -e "${YELLOW}⚠️  未找到PostgreSQL相关的ACL规则${NC}"
        fi
    fi
done

# 生成修复建议
echo -e "\n${CYAN}💡 修复建议:${NC}"
echo "=================================="

if [ "$CLUSTER_STATUS" != "available" ]; then
    echo -e "${RED}1. 集群状态异常，当前状态: $CLUSTER_STATUS${NC}"
    echo "   建议: 等待集群恢复到available状态"
fi

echo -e "${YELLOW}2. 安全组配置检查:${NC}"
echo "   • 确保安全组包含端口5432的入站规则"
echo "   • 源IP范围应该包含应用服务器的IP"
echo "   • 避免使用0.0.0.0/0作为源IP（安全风险）"

echo -e "${YELLOW}3. 网络配置检查:${NC}"
echo "   • 确保应用服务器和RDS在同一VPC或配置了VPC对等连接"
echo "   • 检查路由表配置"
echo "   • 确保网络ACL允许5432端口流量"

echo -e "${YELLOW}4. RDS配置检查:${NC}"
echo "   • 确认公共访问设置"
echo "   • 检查数据库参数组配置"
echo "   • 验证SSL/TLS设置"

echo -e "\n${GREEN}🔧 快速修复命令示例:${NC}"
echo "# 添加安全组规则（替换YOUR_IP为实际IP）"
echo "aws ec2 authorize-security-group-ingress \\"
echo "  --group-id $SG_ID \\"
echo "  --protocol tcp \\"
echo "  --port 5432 \\"
echo "  --cidr YOUR_IP/32 \\"
echo "  --region $AWS_REGION"

echo -e "\n${BLUE}📖 相关AWS文档:${NC}"
echo "• RDS安全组: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html"
echo "• VPC配置: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.html"