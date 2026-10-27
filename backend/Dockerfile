FROM php:apache

# Install mysqli and PDO
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Enable Apache mod_rewrite for cleaner URLs
RUN a2enmod rewrite

# Set working directory
WORKDIR /var/www/html