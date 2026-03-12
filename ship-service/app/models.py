from django.db import models

class Shipment(models.Model):
    order_id = models.IntegerField()
    address = models.CharField(max_length=255)
    method = models.CharField(max_length=50)
    status = models.CharField(max_length=50, default='Pending')
