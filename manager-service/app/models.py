from django.db import models

class Manager(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    department = models.CharField(max_length=100)
    password = models.CharField(
        max_length=255,
        default="pbkdf2_sha256$600000$SCELZVhzLE8eljLSuLuwow$I7iY77nNiWBc6E3Ree1U/bBc96VYNbB6/uNEsaEugno=",
    )
