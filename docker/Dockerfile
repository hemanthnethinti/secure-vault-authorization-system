FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install additional dependencies
RUN apk add --no-cache bash curl git

# Copy package files
COPY package.json package-lock.json ./

# Install npm dependencies
RUN npm install

# Copy entire project
COPY . .

# Make entrypoint script executable
RUN chmod +x ./docker/entrypoint.sh

# Expose the Hardhat node RPC port
EXPOSE 8545

# Run the entrypoint script
ENTRYPOINT ["sh", "./docker/entrypoint.sh"]
