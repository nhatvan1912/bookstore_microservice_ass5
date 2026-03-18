from django.db import models

class Order(models.Model):
    customer_id = models.IntegerField()
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=50, default='Pending')
    rejection_reason = models.TextField(blank=True, default='')
    pay_method = models.CharField(max_length=50, default='Credit Card')
    payment_details = models.TextField(blank=True, default='')
    ship_method = models.CharField(max_length=50, default='Standard')
    shipping_address = models.CharField(max_length=255, blank=True, default='')

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    book_id = models.IntegerField()
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
