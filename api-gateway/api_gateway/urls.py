from django.contrib import admin
from django.urls import path, re_path
from api_gateway.views import auth_login, auth_me, auth_register_customer, index, proxy_api

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', index),
    path('auth/login/', auth_login),
    path('auth/register/', auth_register_customer),
    path('auth/me/', auth_me),
    re_path(r'^api/(?P<service_name>[a-z\-]+)/(?P<path>.*)$', proxy_api),
]
