from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0002_order_payment_details_order_shipping_address_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='rejection_reason',
            field=models.TextField(blank=True, default=''),
        ),
    ]
