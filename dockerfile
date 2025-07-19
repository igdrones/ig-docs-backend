# Use an official Node.js runtime as the base image
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Run prisma generate to generate the Prisma client
RUN npx prisma generate

# Expose the application's port (replace 3000 with your app's port)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]