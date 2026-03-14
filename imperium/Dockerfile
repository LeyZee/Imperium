FROM node:20-alpine

WORKDIR /app

# Backend dependencies
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

# Frontend build
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Copy backend source
COPY backend/ backend/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["node", "backend/server.js"]
