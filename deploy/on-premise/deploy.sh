#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 3 || ! $2 =~ ^[a-f0-9]{7,40}$ || ! $3 =~ ^[a-f0-9]{64}$ ]]; then
    echo "Usage: deploy.sh ARCHIVE RELEASE_ID ARCHIVE_SHA256" >&2
    exit 1
fi
archive="$(realpath -- "$1")"
release_id="$2"
checksum="$3"
service_root="${HOME}/workspaces/colors"
release_dir="${service_root}/releases/${release_id}"
printf '%s  %s\n' "${checksum}" "${archive}" | sha256sum --check
[[ ! -e "${service_root}/current" || -L "${service_root}/current" ]] || {
    echo "The current path must be a release symlink." >&2
    exit 1
}
if [[ ! -d "${release_dir}" ]]; then
    staging="$(mktemp -d "${service_root}/releases/.staging-XXXXXX")"
    tar --extract --gzip --file "${archive}" --directory "${staging}" \
        --no-same-owner --no-same-permissions
    [[ -s "${staging}/index.html" && -s "${staging}/favicon.svg" &&
        -d "${staging}/assets" ]]
    mv -- "${staging}" "${release_dir}"
fi
for asset in "${release_dir}"/assets/*; do
    destination="${service_root}/shared/assets/$(basename -- "${asset}")"
    if [[ -e "${destination}" ]]; then
        cmp -- "${asset}" "${destination}"
    else
        install -m 644 "${asset}" "${destination}"
    fi
done

previous="$(readlink "${service_root}/current" || true)"
ln -sfn -- "releases/${release_id}" "${service_root}/.current-next"
mv -Tf -- "${service_root}/.current-next" "${service_root}/current"
response="$(mktemp "${HOME}/.cache/colors/origin-XXXXXX")"
trap 'rm -f -- "${response}"' EXIT
if ! systemctl --user restart colors.service ||
    ! curl --fail --silent --show-error --retry 4 --retry-connrefused \
        --retry-delay 1 http://127.0.0.1:4380/ --output "${response}" ||
    ! cmp --silent "${response}" "${release_dir}/index.html"; then
    if [[ -n "${previous}" ]]; then
        ln -sfn -- "${previous}" "${service_root}/.current-next"
        mv -Tf -- "${service_root}/.current-next" "${service_root}/current"
        systemctl --user restart colors.service
    else
        systemctl --user stop colors.service
    fi
    echo "Origin verification failed; previous service restored if present." >&2
    exit 1
fi
if [[ -n "${previous}" && "${previous}" != "releases/${release_id}" ]]; then
    ln -sfn -- "${previous}" "${service_root}/previous"
fi
systemctl --user is-active colors.service
readlink "${service_root}/current"
