# See .gcloudignore for files not to be deployed
# The default deployable is app.yaml, which should load the whole app.
# Always specifying the same version causes that version to be replaced,
# rather than a new version being created and leaving the old one up.
# Specifying the project id ensures deploying this project rather than
# whatever was last selected in the admin interface.
gcloud app deploy --version 1 --project lsvizx
