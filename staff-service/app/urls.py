from django.urls import path
from .views import StaffListCreate, StaffDetail, StaffLogin

urlpatterns = [
    path('staff/', StaffListCreate.as_view()),
    path('staff/<int:pk>/', StaffDetail.as_view()),
    path('staff/login/', StaffLogin.as_view()),
]
