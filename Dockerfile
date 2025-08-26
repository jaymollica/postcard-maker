# Multi-stage Dockerfile for mail app
# Stage 1: Build React Frontend
FROM node:16-alpine as frontend-build
WORKDIR /app
COPY fe/package*.json ./
RUN npm ci
COPY fe/ ./
# Use environment variables during build
ARG PUBLIC_URL
ARG REACT_APP_BACKEND_URL  
ARG REACT_APP_FRONTEND_URL
ARG REACT_APP_FRONTEND_ORIGIN
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV PUBLIC_URL=$PUBLIC_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_FRONTEND_URL=$REACT_APP_FRONTEND_URL
ENV REACT_APP_FRONTEND_ORIGIN=$REACT_APP_FRONTEND_ORIGIN
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY
RUN npm run build

# Stage 2: Build Embed Script
FROM node:16-alpine as embed-build
WORKDIR /app
COPY embed/package*.json ./
RUN npm install
COPY embed/ ./
# Use environment variables during build
ARG FRONTEND_ORIGIN
ARG BACKEND_URL
ENV FRONTEND_ORIGIN=$FRONTEND_ORIGIN
ENV BACKEND_URL=$BACKEND_URL
RUN npm run build

# Stage 3: Final stage with PHP + Apache
FROM php:8.1-apache

# Install system dependencies including git, unzip, and zip
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    zip \
    libzip-dev \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions including zip
RUN docker-php-ext-install pdo pdo_mysql mysqli zip

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Allow Composer to run as root (needed for Docker builds)
ENV COMPOSER_ALLOW_SUPERUSER=1

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Set working directory
WORKDIR /var/www/html

# Copy and install PHP backend dependencies
COPY be/ ./be/
WORKDIR /var/www/html/be
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Go back to web root
WORKDIR /var/www/html

# Copy built frontend
COPY --from=frontend-build /app/build ./

# Copy built embed script
COPY --from=embed-build /app/lobby.js ./embed/lobby.js

# Create Apache configuration
RUN echo '<Directory /var/www/html>\n\
    Options Indexes FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>\n\
\n\
# Handle React Router\n\
<Directory /var/www/html>\n\
    RewriteEngine On\n\
    RewriteBase /\n\
    RewriteRule ^index\.html$ - [L]\n\
    RewriteCond %{REQUEST_FILENAME} !-f\n\
    RewriteCond %{REQUEST_FILENAME} !-d\n\
    RewriteCond %{REQUEST_URI} !^/be/\n\
    RewriteCond %{REQUEST_URI} !^/embed/\n\
    RewriteRule . /index.html [L]\n\
</Directory>\n\
\n\
# Handle API routes\n\
Alias /be /var/www/html/be\n\
<Directory /var/www/html/be>\n\
    RewriteEngine On\n\
    RewriteCond %{REQUEST_FILENAME} !-f\n\
    RewriteRule ^(.*)$ index.php [QSA,L]\n\
</Directory>' > /etc/apache2/conf-available/app.conf

RUN a2enconf app

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# Expose port 80
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]