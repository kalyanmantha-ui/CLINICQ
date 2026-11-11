# Deploying ClinicQ to AWS (one EC2 instance)

Status: **executed on a t3.small in us-west-2.** Cost is roughly $20/month while running and about $5/month while stopped (disk and the static IP).

## 1. Launch the instance
- AMI: Ubuntu Server 24.04 LTS, type `t3.small` (2 GB RAM is enough for Postgres + the JVM + nginx once swap is added).
- Storage: 20 GB gp3.
- Security group: allow inbound **80** and **443** from anywhere, **22** from your IP only. Do not open 5432 or 8080 (and 8025 only to your own IP, see step 5).
- Allocate an **Elastic IP** and attach it, so the address survives restarts.

## 2. Add swap and install Docker
```bash
ssh -i <key>.pem ubuntu@<elastic-ip>
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
curl -fsSL https://get.docker.com | sudo sh          # installs Docker Engine and the compose plugin
sudo usermod -aG docker ubuntu                        # log out and back in, or prefix docker with sudo
```
The swap file matters on 2 GB: without it the JVM and Postgres can be killed under load.

## 3. Configure and start
```bash
git clone https://github.com/kalyanmantha-ui/CLINICQ.git && cd CLINICQ
cp .env.example .env
# fill in: DB_PASSWORD, JWT_SECRET (openssl rand -base64 48), FIELD_ENCRYPTION_KEY (openssl rand -base64 32)
docker compose -f docker-compose.prod.yml --profile mailcatcher up -d --build
docker compose -f docker-compose.prod.yml ps        # api should become "healthy"
```
Open `http://<elastic-ip>` and sign in with a demo account. **Back up `FIELD_ENCRYPTION_KEY`**: without it the encrypted
patient fields cannot be read.

## 4. HTTPS (optional, recommended for a public demo)
Point a DNS A record at the Elastic IP, set `SITE_ADDRESS=clinicq.yourdomain.com` in `.env`, then
`docker compose -f docker-compose.prod.yml up -d`. Caddy gets and renews a Let's Encrypt certificate automatically.

## 5. Real reminder emails (optional)
Demo mode catches emails in Mailpit (`http://<ip>:8025`; open port 8025 to your IP only, or skip the `mailcatcher` profile).
For real delivery use Amazon SES SMTP: verify a sender domain/address, create SMTP credentials, then in `.env` set
`MAIL_HOST=email-smtp.<region>.amazonaws.com`, `MAIL_PORT=587`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_AUTH=true`,
`MAIL_STARTTLS=true`, `MAIL_FROM=<verified sender>`. SES sandbox accounts can only send to verified addresses.

## 6. Operating it
- Logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Update: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- Backups: `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U clinicq clinicq > backup.sql`
- Demo data: set `SEED_DEMO=false` once you are done demoing; it only seeds an empty database.
