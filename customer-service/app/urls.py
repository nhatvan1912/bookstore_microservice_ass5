from django.urls import path
from .views import CustomerListCreate, CustomerLogin

urlpatterns = [
    path('customers/login/', CustomerLogin.as_view()),
    path('customers/', CustomerListCreate.as_view()),
]
