FROM php:apache

# Install the PostgreSQL PHP extensions.
# libpq-dev is the PostgreSQL client library that pdo_pgsql and pgsql need to compile.
# The rm at the end just cleans up apt's cache to keep the image smaller.
RUN apt-get update \
    && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache mod_rewrite for cleaner URLs
RUN a2enmod rewrite

# Set working directory
WORKDIR /var/www/html