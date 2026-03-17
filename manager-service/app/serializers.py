from rest_framework import serializers
from .models import Manager

class ManagerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Manager
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True}
        }
