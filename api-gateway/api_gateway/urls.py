from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from api_gateway.views import (
    auth_login,
    auth_me,
    auth_register_customer,
    customer_page,
    index,
    manager_page,
    proxy_api,
    staff_page,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', index),
    path('index.html', index),
    path('customer.html', customer_page),
    path('staff.html', staff_page),
    path('manager.html', manager_page),
    path('auth/login/', auth_login),
    path('auth/register/', auth_register_customer),
    path('auth/me/', auth_me),
    re_path(r'^api/(?P<service_name>[a-z\-]+)/(?P<path>.*)$', proxy_api),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR / 'static')
