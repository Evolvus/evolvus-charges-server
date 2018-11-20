FROM node:8.9-wheezy

RUN npm install pm2 -g
# ENV PM2_PUBLIC_KEY XXXX
# ENV PM2_SECRET_KEY YYYY
COPY . /usr/app-charges-server/
COPY package.json /usr/app-charges-server
#COPY .npmrc ./
WORKDIR /usr/app-charges-server/
RUN npm install --only=production

#default environment variables
ENV NODE_ENV production
ENV PORT 9292
EXPOSE 9292
CMD ["pm2-runtime", "server.js"]