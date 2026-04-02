# Production Deployment Guide

## Overview

This guide covers deploying Code-Clash to production with comprehensive security, monitoring, and scaling features.

## Prerequisites

- Docker and Docker Compose
- Production server with at least 4GB RAM, 2 CPU cores
- SSL certificate (Let's Encrypt recommended)
- Domain name configured
- Environment variables set

## Environment Setup

### 1. Environment Variables

Create `.env` file in project root:

```bash
# Database Configuration
POSTGRES_PASSWORD=your-secure-password
DATABASE_URL=postgresql://postgres:your-secure-password@postgres:5432/codeclash

# Redis Configuration
REDIS_URL=redis://redis:6379

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-256-bits-minimum
JWT_EXPIRES_IN=7d

# Judge0 Configuration
JUDGE0_URL=http://judge0:2358
JUDGE0_API_URL=http://judge0:2358

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Monitoring & Logging
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Grafana Configuration
GRAFANA_PASSWORD=your-grafana-password

# Production Settings
NODE_ENV=production
PORT=3001
```

### 2. SSL Certificate Setup

#### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certificate will be automatically configured in Nginx
```

#### Manual SSL Setup

```bash
# Place certificates in nginx/ssl directory
mkdir -p nginx/ssl
cp your-cert.pem nginx/ssl/
cp your-key.pem nginx/ssl/
```

## Deployment Steps

### 1. Clone and Prepare Repository

```bash
git clone https://github.com/your-username/code-clash.git
cd code-clash

# Copy environment template
cp .env.example .env
# Edit .env with your production values
```

### 2. Build and Deploy

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
sleep 30

# Run database migrations
docker-compose -f docker-compose.prod.yml exec api npm run db:migrate

# Optimize database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d codeclash -f /docker-entrypoint-initdb.d/optimize.sql
```

### 3. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Health checks
curl https://yourdomain.com/health
curl https://yourdomain.com/api/health
curl https://yourdomain.com/api/health
```

## Service Configuration

### 1. Nginx Configuration

The production setup includes Nginx with SSL termination and load balancing:

```nginx
# nginx/nginx.conf is automatically configured
# Features:
# - SSL termination
# - HTTP to HTTPS redirect
# - Static file serving
# - Rate limiting
# - Security headers
```

### 2. Database Optimization

Run the optimization script:

```bash
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d codeclash -f /docker-entrypoint-initdb.d/optimize.sql
```

This creates:
- Optimized indexes for performance
- Materialized views for complex queries
- Partitioning for large tables
- Statistics updates

### 3. Redis Configuration

Redis is configured with:
- Persistence enabled
- Memory optimization
- Connection pooling
- Cache invalidation strategies

## Monitoring Setup

### 1. Grafana Dashboard

Access: `https://yourdomain.com:3001`

Default credentials:
- Username: admin
- Password: Set in GRAFANA_PASSWORD environment variable

### 2. Prometheus Metrics

Access: `https://yourdomain.com:9090`

Monitors:
- Application metrics
- Database performance
- Redis performance
- System resources

### 3. Log Aggregation

Logs are collected by:
- Loki for storage
- Promtail for collection
- Grafana for visualization

Access logs at: `https://yourdomain.com:3001/explore`

## Security Hardening

### 1. Network Security

```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5432/tcp  # PostgreSQL
sudo ufw deny 6379/tcp  # Redis
sudo ufw deny 2358/tcp  # Judge0
```

### 2. Application Security

- JWT authentication with secure secrets
- Rate limiting per user and IP
- Input validation with Zod schemas
- Code sanitization and XSS protection
- CORS configuration
- Security headers

### 3. Container Security

- Non-root users in containers
- Minimal base images
- Resource limits
- Health checks
- Read-only filesystems where possible

## Performance Optimization

### 1. Caching Strategy

- Redis caching for puzzles (10min TTL)
- Leaderboard caching (30s TTL)
- User profile caching (60s TTL)
- Cache invalidation on updates

### 2. Database Performance

- Optimized indexes
- Connection pooling
- Query optimization
- Materialized views
- Partitioning for scale

### 3. Application Performance

- Node.js clustering
- Compression middleware
- Static asset optimization
- Lazy loading for code editor

## Scaling Strategy

### 1. Horizontal Scaling

```bash
# Scale API services
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# Scale judge services
docker-compose -f docker-compose.prod.yml up -d --scale judge=2
```

### 2. Load Balancing

- Nginx load balances API instances
- Socket.io Redis adapter for WebSocket scaling
- Database connection pooling
- Redis clustering for cache scaling

### 3. Resource Management

Monitor and adjust:
- CPU and memory limits
- Database connections
- Redis memory usage
- Container restart policies

## Backup Strategy

### 1. Database Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres codeclash | gzip > "backup_$DATE.sql.gz"
# Upload to cloud storage (AWS S3, etc.)
aws s3 cp "backup_$DATE.sql.gz" s3://your-backup-bucket/
EOF

chmod +x backup.sh

# Schedule daily backups
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

### 2. Redis Backups

```bash
# Redis persistence is enabled (AOF + RDB)
# Backups are stored in redis_data volume
```

### 3. Application Backups

- Docker images are versioned in registry
- Configuration files in version control
- Environment variables backed up securely

## Maintenance

### 1. Updates

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart services with zero downtime
docker-compose -f docker-compose.prod.yml up -d --no-deps api
docker-compose -f docker-compose.prod.yml up -d --no-deps judge
docker-compose -f docker-compose.prod.yml up -d --no-deps web
```

### 2. Log Rotation

```bash
# Configure logrotate
sudo nano /etc/logrotate.d/code-clash

# Content:
/var/log/code-clash/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose -f /path/to/docker-compose.prod.yml restart api judge
    endscript
}
```

### 3. Health Monitoring

Set up monitoring alerts:
- Uptime monitoring (UptimeRobot)
- Performance alerts (Grafana)
- Error tracking (Sentry)
- Resource usage alerts

## Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   docker-compose -f docker-compose.prod.yml logs service-name
   ```

2. **Database connection issues**
   ```bash
   docker-compose -f docker-compose.prod.yml exec postgres pg_isready
   ```

3. **Redis connection issues**
   ```bash
   docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
   ```

4. **High memory usage**
   ```bash
   docker stats
   # Adjust resource limits in docker-compose.prod.yml
   ```

### Performance Issues

1. **Slow database queries**
   - Check `EXPLAIN ANALYZE` output
   - Verify indexes are being used
   - Monitor slow query log

2. **High CPU usage**
   - Check application logs for errors
   - Monitor Judge0 queue length
   - Scale services if needed

3. **Memory leaks**
   - Restart services periodically
   - Monitor memory usage trends
   - Check for Node.js memory leaks

## Emergency Procedures

### 1. Service Recovery

```bash
# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart api

# Force recreation
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

### 2. Database Recovery

```bash
# Restore from backup
gunzip backup_YYYYMMDD_HHMMSS.sql.gz
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres codeclash < backup_YYYYMMDD_HHMMSS.sql
```

### 3. Emergency Rollback

```bash
# Rollback to previous image version
docker-compose -f docker-compose.prod.yml pull your-registry/code-clash/api:previous-tag
docker-compose -f docker-compose.prod.yml up -d api
```

## Support and Monitoring

### 1. Monitoring Dashboard

- Grafana: `https://yourdomain.com:3001`
- Prometheus: `https://yourdomain.com:9090`
- Application logs: Available in Grafana

### 2. Alert Configuration

Set up alerts for:
- Service downtime
- High error rates
- Performance degradation
- Resource exhaustion

### 3. Documentation

- API documentation: `https://yourdomain.com/docs`
- System monitoring: Grafana dashboards
- Error tracking: Sentry dashboard

## Compliance and Security

### 1. Data Protection

- GDPR compliance features
- Data encryption at rest and in transit
- User data deletion capabilities
- Audit logging

### 2. Security Scanning

- Regular vulnerability scanning
- Dependency updates
- Security headers validation
- Penetration testing

### 3. Access Control

- Role-based access control
- API rate limiting
- IP whitelisting for admin access
- Multi-factor authentication for admin

This production setup provides a secure, scalable, and monitored deployment of Code-Clash with enterprise-grade features.
