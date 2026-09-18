FROM nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY images/ /usr/share/nginx/html/images/
COPY stemcell/ /usr/share/nginx/html/stemcell/
COPY korea-travel/ /usr/share/nginx/html/korea-travel/

EXPOSE 80
