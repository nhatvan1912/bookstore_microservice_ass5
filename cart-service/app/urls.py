from django.urls import path
from .views import CartCreate, CartItemModify, ViewCart

urlpatterns = [
    path('carts/', CartCreate.as_view()),
    path('carts/items/', CartItemModify.as_view()),
    path('carts/items/<int:pk>/', CartItemModify.as_view()),
    path('carts/customer/<int:customer_id>/', ViewCart.as_view()),
]
