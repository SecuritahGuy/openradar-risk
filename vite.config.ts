import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/regional/cal-fire": {
        target: "https://incidents.fire.ca.gov",
        changeOrigin: true,
        rewrite: () => "/umbraco/api/incidentapi/List",
      },
      "/api/emsc": {
        target: "https://www.seismicportal.eu",
        changeOrigin: true,
        rewrite: () => "/fdsnws/event/1/query",
      },
      "/api/smithsonian/gvp": {
        target: "https://webservices.volcano.si.edu",
        changeOrigin: true,
        rewrite: (path) => path.replace(
          "/api/smithsonian/gvp",
          "/geoserver/GVP-VOTW/wfs"
        ),
      },
      "/api/jma/typhoons": {
        target: "https://www.jma.go.jp",
        changeOrigin: true,
        rewrite: (path) => {
          const requested = new URL(path, "http://localhost");
          const file = requested.searchParams.get("file");
          return `/bosai/typhoon/data/${file}`;
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/data/")) return "location-data";
          if (
            id.includes("/node_modules/leaflet/") ||
            id.includes("/node_modules/react-leaflet/") ||
            id.includes("/node_modules/@react-leaflet/")
          ) {
            return "map-vendor";
          }
          if (id.includes("/node_modules/")) return "vendor";
        },
      },
    },
  },
})
