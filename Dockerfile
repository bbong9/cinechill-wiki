FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY favicon.ico /usr/share/nginx/html/favicon.ico
COPY index.html favicon.ico README.md /usr/share/nginx/html/cinechill-wiki/
COPY cinechill /usr/share/nginx/html/cinechill-wiki/cinechill
COPY wiki /usr/share/nginx/html/cinechill-wiki/wiki
