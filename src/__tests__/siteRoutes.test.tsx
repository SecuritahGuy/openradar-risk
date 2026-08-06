import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePage } from "../pages/HomePage";
import {
  AboutPage,
  DataSourcesPage,
  MethodologyPage,
  PrivacyPage,
} from "../pages/InformationPages";
import { LearnIndexPage } from "../pages/LearnPages";
import { isAdEligibleRoute } from "../config/advertising";
import { learnArticles } from "../data/learnArticles";
import { dataSources } from "../data/dataSources";
import { normalizePath } from "../router";
import { LEARN_ARTICLE_PATHS, routeKind } from "../routes";

describe("public site routes", () => {
  it("maps every requested path and unknown paths", () => {
    expect(routeKind("/")).toBe("home");
    expect(routeKind("/app")).toBe("dashboard");
    expect(routeKind("/learn")).toBe("learn");
    LEARN_ARTICLE_PATHS.forEach((path) => expect(routeKind(path)).toBe("article"));
    expect(routeKind("/missing")).toBe("not-found");
    expect(normalizePath("/learn/")).toBe("/learn");
  });

  it("renders homepage CTAs and internal navigation as links", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('href="/app"');
    expect(html).toContain('href="/methodology"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain("Open Live Radar");
    expect(html).toContain("optional background monitoring");
  });

  it("keeps public monitoring descriptions aligned with production behavior", () => {
    const methodology = renderToStaticMarkup(<MethodologyPage />);
    const privacy = renderToStaticMarkup(<PrivacyPage />);
    const about = renderToStaticMarkup(<AboutPage />);
    const sources = renderToStaticMarkup(<DataSourcesPage />);

    expect(methodology).toContain("each location evaluated in a separate queued Worker invocation");
    expect(methodology).toContain("NWS, USGS, NIFC, NHC, JMA, GDACS, and NASA EONET");
    expect(methodology).toContain("They do not enter the active feed, risk posture, incident correlation, or background notifications");
    expect(privacy).toContain("Last reviewed July 29, 2026");
    expect(privacy).toContain("Humanitarian OpenStreetMap Team API");
    expect(privacy).toContain("routinely removed after 30 days");
    expect(about).toContain("explicitly enable background monitoring");
    expect(sources).toContain("aggregate active-storm forecast-point layer");
  });

  it("renders all learning articles in the learning center", () => {
    const html = renderToStaticMarkup(<LearnIndexPage />);
    expect(learnArticles).toHaveLength(6);
    for (const article of learnArticles) {
      expect(article.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.sources.length).toBeGreaterThan(0);
      expect(html).toContain(`/learn/${article.slug}`);
    }
  });

  it("keeps operational and legal routes ad-free", () => {
    expect(isAdEligibleRoute("/")).toBe(true);
    expect(isAdEligibleRoute("/learn/earthquakes")).toBe(true);
    expect(isAdEligibleRoute("/app")).toBe(false);
    expect(isAdEligibleRoute("/privacy")).toBe(false);
    expect(isAdEligibleRoute("/terms")).toBe(false);
    expect(isAdEligibleRoute("/contact")).toBe(false);
    expect(isAdEligibleRoute("/404")).toBe(false);
  });

  it("provides complete source metadata", () => {
    expect(dataSources.length).toBeGreaterThan(10);
    dataSources.forEach((source) => {
      expect(source.name).toBeTruthy();
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.limitations).toBeTruthy();
      expect(source.handling).toBeTruthy();
    });
  });
});
