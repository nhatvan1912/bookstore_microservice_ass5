from django.contrib import admin
from django.urls import path, re_path
from api_gateway.views import index, proxy_api

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', index),
    re_path(r'^api/(?P<service_name>[a-z\-]+)/(?P<path>.*)$', proxy_api),
]
