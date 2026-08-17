# Apify base image with Node 22 + Playwright + Chrome preinstalled.
FROM apify/actor-node-playwright-chrome:22

# Copy manifests first so Docker layer-caches the install step.
COPY --chown=myuser package*.json ./

# Install prod deps. Playwright itself comes from the base image, so we keep
# the browser download skipped to avoid a ~400 MB duplicate.
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && rm -r ~/.npm

COPY --chown=myuser . ./

CMD ./start_xvfb_and_run_cmd.sh && npm run start --silent
