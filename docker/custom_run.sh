#!/bin/bash
# Shim for local dev with upstream dspace/dspace image, which lacks the ufal custom_run.sh.
# The ufal image provides its own custom_run.sh; this file is only used via docker-compose.dev.yml.
exec /usr/local/tomcat/bin/catalina.sh run
