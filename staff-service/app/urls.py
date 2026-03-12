from django.urls import path
from .views import StaffListCreate

urlpatterns = [
    path('staff/', StaffListCreate.as_view()),
]
