from django.conf.urls import patterns, include, url

urlpatterns = patterns('',
	url(r'^$', 'ladder.views.home'),
	url(r'^cargo/$','ladder.views.cargo'),
	url(r'^cargo/([\w\s]*)/$','ladder.views.cargo'),
)
