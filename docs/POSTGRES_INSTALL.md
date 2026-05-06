# PostgreSQL Installation & Configuration Guide

This guide describes how to set up PostgreSQL for the General Ward application in a production hospital environment.

## 1. Prerequisites
- Ubuntu 22.04 LTS (or similar Linux distribution)
- Root or sudo access

## 2. Install PostgreSQL 16
It is recommended to use the official PostgreSQL repository for the latest security patches.

```bash
# Add the PostgreSQL signing key
sudo apt-get update
sudo apt-get install wget ca-certificates
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Add the repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Install
sudo apt-get update
sudo apt-get install postgresql-16
```

## 3. Database Configuration
Create a dedicated user and database for the application.

```bash
sudo -u postgres psql

# Inside psql:
CREATE USER wardapp WITH PASSWORD 'your_strong_password_here';
CREATE DATABASE warddb OWNER wardapp;
GRANT ALL PRIVILEGES ON DATABASE warddb TO wardapp;
\q
```

## 4. Application Setup
1. Copy the example environment file:
   `cp ward-backend/.env.postgres.example ward-backend/.env`
2. Update the variables in `.env`:
   - `DB_DIALECT=postgres`
   - `PG_HOST=localhost`
   - `PG_PORT=5432`
   - `PG_DATABASE=warddb`
   - `PG_USER=wardapp`
   - `PG_PASSWORD=your_strong_password_here`

## 5. Data Migration (If upgrading from SQLite)
If you are upgrading an existing installation, run the migration script:

```bash
cd ward-backend
npm run migrate:postgres
```

## 6. Maintenance & Backups
Set up a daily cron job for backups.

```bash
# /etc/cron.d/ward-backup
0 2 * * * postgres pg_dump warddb | gzip > /var/backups/ward_$(date +\%Y\%m\%m).sql.gz
```

## 7. Performance Tuning
For a typical hospital ward server (8GB RAM), consider these `postgresql.conf` adjustments:
- `shared_buffers = 2GB`
- `effective_cache_size = 6GB`
- `work_mem = 64MB`
- `maintenance_work_mem = 512MB`
