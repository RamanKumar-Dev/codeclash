# Code-Clash Production Deployment Guide

## Overview

This guide covers deploying Code-Clash to production with security, performance, and monitoring best practices.

## Prerequisites

- Docker & Docker Compose
- SSL certificates (Let's Encrypt recommended)
- Domain name configured
- Production server (VPS or cloud provider)
- Environment variables configured

## Quick Deploy

```bash
# Clone repository
git clone https://github.com/your-org/code-clash.git
cd code-clash

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml run --rm api npm run migrate

# Create database indexes
docker-compose -f docker-compose.prod.yml run --rm api npm run indexes
```

## Environment Configuration

### Required Environment Variables

```bash
# Database
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://postgres:your_secure_password@postgres:5432/codeclash

# Redis
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=your_super_secure_jwt_secret_key_at_least_32_characters
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Services
JUDGE0_URL=http://judge0:2358

# Monitoring
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
LOG_LEVEL=info

# Clustering
CLUSTER_WORKERS=4
```

### Optional Environment Variables

```bash
# SSL
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## Security Configuration

### 1. SSL/TLS Setup

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Firewall Setup

```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Nginx Configuration

Update `nginx/nginx.conf` with your domain:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # SSL hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;
    
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://frontend:3001;
        # ... other proxy settings
    }
    
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://frontend:3001;
    }
}
```

## Performance Optimization

### 1. Database Optimization

```bash
# Connect to MongoDB
docker-compose exec postgres mongo

# Create indexes (handled automatically by migrations)
npm run indexes

# Monitor slow queries
db.setProfilingLevel(2, {slowms: 100})
```

### 2. Redis Configuration

Update `redis/redis.conf`:

```conf
# Memory optimization
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
requirepass your_redis_password
```

### 3. Node.js Clustering

The application automatically uses clustering based on `CLUSTER_WORKERS` env var:

```bash
# Use all CPU cores
export CLUSTER_WORKERS=$(nproc)

# Or set specific number
export CLUSTER_WORKERS=4
```

## Monitoring Setup

### 1. Prometheus Configuration

Access at `http://yourdomain.com:9090`

Default credentials:
- Username: admin
- Password: Set via `GRAFANA_PASSWORD` env var

### 2. Grafana Dashboards

Access at `http://yourdomain.com:3001`

Pre-configured dashboards:
- Application Performance
- Database Metrics
- Redis Performance
- Judge Service Stats

### 3. Log Aggregation

Logs are automatically collected by Loki and viewable in Grafana.

### 4. Health Checks

```bash
# Application health
curl https://yourdomain.com/health

# Detailed health status
curl https://yourdomain.com/api/health/detailed
```

## Scaling Guide

### Horizontal Scaling

1. **Add more API instances:**

```yaml
# docker-compose.prod.yml
api:
  deploy:
    replicas: 5  # Increase from 3
```

2. **Load balancer setup:**

```nginx
upstream api_backend {
    server api_1:3001;
    server api_2:3001;
    server api_3:3001;
    # Add more instances as needed
}
```

3. **Redis Adapter:**

The Socket.io Redis adapter automatically handles multi-node communication.

### Database Scaling

1. **Read replicas:**
   - Configure MongoDB replica set
   - Update connection string for reads

2. **Connection pooling:**
   - Already optimized with connection limits

## Backup Strategy

### 1. Database Backups

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec postgres pg_dump -U postgres codeclash > backup_$DATE.sql

# Upload to cloud storage
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/

# Cleanup old backups (keep 7 days)
find . -name "backup_*.sql" -mtime +7 -delete
```

### 2. Redis Backups

```bash
# Save Redis data
docker-compose exec redis redis-cli BGSAVE

# Copy RDB file
docker cp redis_container:/data/dump.rdb ./redis_backup_$DATE.rdb
```

## Troubleshooting

### Common Issues

1. **High Memory Usage:**
   ```bash
   # Check memory usage
   docker stats
   
   # Restart services
   docker-compose restart
   ```

2. **Database Connection Issues:**
   ```bash
   # Check database logs
   docker-compose logs postgres
   
   # Test connection
   docker-compose exec postgres psql -U postgres -d codeclash
   ```

3. **Judge Service Issues:**
   ```bash
   # Check Judge0 status
   curl http://localhost:2358/system
   
   # Restart judge service
   docker-compose restart judge0 judge
   ```

### Performance Debugging

1. **Enable profiling:**
   ```bash
   # MongoDB profiling
   docker-compose exec mongo mongo --eval "db.setProfilingLevel(2)"
   ```

2. **Monitor Redis:**
   ```bash
   # Redis info
   docker-compose exec redis redis-cli info memory
   docker-compose exec redis redis-cli info stats
   ```

3. **Application logs:**
   ```bash
   # Real-time logs
   docker-compose logs -f api
   
   # Error logs only
   docker-compose logs api | grep ERROR
   ```

## Security Checklist

- [ ] SSL certificates installed and auto-renewing
- [ ] Firewall configured
- [ ] JWT secrets are strong (>32 chars)
- [ ] Database passwords are strong
- [ ] Rate limiting configured
- [ ] Security headers enabled (Helmet.js)
- [ ] Input validation implemented (Zod)
- [ ] Code execution sandboxed (Judge0)
- [ ] Regular security updates applied
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured

## Maintenance Tasks

### Daily

- Monitor application health
- Check error rates in Sentry
- Review performance metrics

### Weekly

- Apply security updates
- Review backup logs
- Check disk space usage

### Monthly

- Update SSL certificates
- Review and rotate secrets
- Performance optimization review

## Emergency Procedures

### 1. Service Outage

```bash
# Quick restart
docker-compose restart

# Full rebuild
docker-compose down
docker-compose pull
docker-compose up -d
```

### 2. Database Corruption

```bash
# Restore from backup
docker-compose stop postgres
docker-compose run --rm -v $(pwd)/backups:/backups postgres \
  psql -U postgres -d codeclash < /backups/latest_backup.sql
docker-compose start postgres
```

### 3. Security Incident

1. Immediately rotate all secrets
2. Review access logs
3. Update firewall rules
4. Force logout all users
5. Monitor for suspicious activity

## Support

For production issues:

1. Check this guide first
2. Review application logs
3. Check monitoring dashboards
4. Contact support with detailed error information

---

**Remember:** This is a production deployment. Always test changes in a staging environment first!
