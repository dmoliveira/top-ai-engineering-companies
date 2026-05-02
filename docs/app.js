const DATA_URL = "data/companies.json";

const state = {
  companies: [],
  filteredCompanies: [],
  currentRoot: null,
  selectedCompanyId: null,
  viewMode: "radial",
  filters: {
    search: "",
    country: "",
    businessType: "",
    subType: "",
    tag: ""
  }
};

const palette = ["#4f46e5", "#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#22c55e", "#94a3b8"];
const color = d3.scaleOrdinal().range(palette).unknown("#64748b");

const visualizationHost = document.getElementById("visualization");
const breadcrumb = document.getElementById("breadcrumb");
const detailsPanel = document.getElementById("details-panel");
const activeSummary = document.getElementById("active-summary");
const legend = document.getElementById("legend");
const vizEyebrow = document.getElementById("viz-eyebrow");
const vizHeading = document.getElementById("viz-heading");
const viewButtons = [...document.querySelectorAll("[data-view-mode]")];

const inputs = {
  search: document.getElementById("search-input"),
  country: document.getElementById("country-select"),
  businessType: document.getElementById("business-type-select"),
  subType: document.getElementById("sub-type-select"),
  tag: document.getElementById("tag-select")
};

const statCompanies = document.getElementById("stat-companies");
const statBusinessTypes = document.getElementById("stat-business-types");
const statCountries = document.getElementById("stat-countries");

const tooltip = document.createElement("div");
tooltip.className = "tooltip hidden";
document.body.appendChild(tooltip);

let resizeTimer = null;

document.getElementById("reset-filters").addEventListener("click", () => {
  state.filters = { search: "", country: "", businessType: "", subType: "", tag: "" };
  Object.values(inputs).forEach((el) => {
    el.value = "";
  });
  applyFilters();
});

Object.entries(inputs).forEach(([key, input]) => {
  input.addEventListener("input", (event) => {
    state.filters[key] = event.target.value.trim();
    applyFilters();
  });
  input.addEventListener("change", (event) => {
    state.filters[key] = event.target.value.trim();
    applyFilters();
  });
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.viewMode = button.dataset.viewMode;
    updateViewModeUI();
    renderVisualization(state.currentRoot);
  });
});

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => renderVisualization(state.currentRoot), 120);
});

async function init() {
  const companies = await d3.json(DATA_URL);
  state.companies = companies;
  color.domain(uniqueSorted(companies.map((company) => company.business_type)));
  populateFilters(companies);
  updateHeroStats(companies);
  state.selectedCompanyId = companies[0]?.id ?? null;
  updateViewModeUI();
  applyFilters();
}

function populateFilters(companies) {
  fillSelect(inputs.country, uniqueSorted(companies.map((company) => company.country)), "All countries");
  fillSelect(inputs.businessType, uniqueSorted(companies.map((company) => company.business_type)), "All business types");
  fillSelect(inputs.subType, uniqueSorted(companies.flatMap((company) => company.sub_type)), "All sub-types");
  fillSelect(inputs.tag, uniqueSorted(companies.flatMap((company) => company.tags)), "All tags");
}

function fillSelect(select, values, label) {
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = label;
  select.appendChild(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function applyFilters() {
  const { search, country, businessType, subType, tag } = state.filters;
  const normalizedSearch = search.toLowerCase();

  state.filteredCompanies = state.companies.filter((company) => {
    const searchText = [
      company.name,
      company.business_type,
      company.sub_type.join(" "),
      company.tags.join(" "),
      company.description_short,
      company.country
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!normalizedSearch || searchText.includes(normalizedSearch)) &&
      (!country || company.country === country) &&
      (!businessType || company.business_type === businessType) &&
      (!subType || company.sub_type.includes(subType)) &&
      (!tag || company.tags.includes(tag))
    );
  });

  if (!state.filteredCompanies.some((company) => company.id === state.selectedCompanyId)) {
    state.selectedCompanyId = state.filteredCompanies[0]?.id ?? null;
  }

  state.currentRoot = buildHierarchy(state.filteredCompanies);
  renderSummary();
  renderLegend();
  renderVisualization(state.currentRoot);
  renderDetails();
}

function buildHierarchy(companies) {
  const root = { name: "All companies", children: [] };
  const businessTypeMap = new Map();

  companies.forEach((company) => {
    if (!businessTypeMap.has(company.business_type)) {
      const node = { name: company.business_type, children: [] };
      businessTypeMap.set(company.business_type, node);
      root.children.push(node);
    }

    const businessNode = businessTypeMap.get(company.business_type);
    const subTypeValue = company.sub_type[0] ?? "Other";

    let subTypeNode = businessNode.children.find((child) => child.name === subTypeValue);
    if (!subTypeNode) {
      subTypeNode = { name: subTypeValue, children: [] };
      businessNode.children.push(subTypeNode);
    }

    subTypeNode.children.push({
      name: company.name,
      value: 1,
      companyId: company.id,
      company
    });
  });

  return d3.hierarchy(root).sum((node) => node.value || 0).sort((a, b) => b.value - a.value);
}

function renderSummary() {
  const count = state.filteredCompanies.length;
  activeSummary.textContent =
    count === state.companies.length
      ? `Showing all ${count} companies in the directory.`
      : `Showing ${count} of ${state.companies.length} companies after filters.`;
}

function renderLegend() {
  const businessTypes = uniqueSorted(state.companies.map((company) => company.business_type));
  legend.replaceChildren();

  businessTypes.forEach((businessType) => {
    const item = createElement("span", { className: "legend-item" });
    const swatch = createElement("span", { className: "legend-swatch" });
    swatch.style.background = color(businessType);
    item.append(swatch, document.createTextNode(businessType));
    legend.append(item);
  });
}

function updateViewModeUI() {
  const isRadial = state.viewMode === "radial";
  vizEyebrow.textContent = isRadial ? "Radial tree" : "Treemap";
  vizHeading.textContent = isRadial
    ? "D3 radial tree of top AI and engineering companies"
    : "D3 treemap of top AI and engineering companies";

  viewButtons.forEach((button) => {
    const active = button.dataset.viewMode === state.viewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderVisualization(root) {
  if (!root) {
    renderEmptyVisualization("Loading company directory…");
    return;
  }

  if (state.viewMode === "radial") {
    renderRadialTree(root);
    return;
  }

  renderTreemap(root);
}

function renderEmptyVisualization(message) {
  const empty = createElement("div", { className: "empty-state", text: message });
  empty.style.padding = "1rem";
  visualizationHost.replaceChildren(empty);
}

function renderTreemap(root) {
  visualizationHost.replaceChildren();
  if (!state.filteredCompanies.length) {
    renderEmptyVisualization("No companies match the current filters.");
    breadcrumb.textContent = "No matches";
    return;
  }

  const width = visualizationHost.clientWidth || 960;
  const height = Math.max(540, Math.min(820, Math.round(width * 0.62)));

  d3.treemap().size([width, height]).paddingOuter(4).paddingTop((node) => (node.depth < 2 ? 28 : 18)).paddingInner(3)(root);

  const svg = d3.create("svg").attr("viewBox", [0, 0, width, height]).attr("role", "presentation");
  const group = svg.append("g");

  const nodes = group
    .selectAll("g")
    .data(root.descendants().filter((node) => node.depth > 0))
    .join("g")
    .attr("class", (node) => `node ${node.children ? "node--branch" : "node--leaf"}`)
    .attr("transform", (node) => `translate(${node.x0},${node.y0})`)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (node) => nodeAriaLabel(node))
    .style("cursor", "pointer")
    .on("click", (_, node) => handleNodeClick(node))
    .on("keydown", (event, node) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNodeClick(node);
      }
    })
    .on("mousemove", (event, node) => showTooltip(event, node))
    .on("focus", (event, node) => showTooltip(event, node))
    .on("blur", hideTooltip)
    .on("mouseleave", hideTooltip);

  nodes
    .append("rect")
    .attr("width", (node) => Math.max(0, node.x1 - node.x0))
    .attr("height", (node) => Math.max(0, node.y1 - node.y0))
    .attr("rx", 12)
    .attr("fill", (node) => color(resolveBusinessType(node)))
    .attr("opacity", (node) => (node.children ? 0.84 - node.depth * 0.08 : 0.95));

  nodes.each(function drawLabels(node) {
    const nodeGroup = d3.select(this);
    const widthAvailable = node.x1 - node.x0;
    const heightAvailable = node.y1 - node.y0;
    const label = node.data.name;
    const secondary = !node.children && node.data.company ? `${node.data.company.country} · ${node.data.company.sub_type[0]}` : null;

    if (widthAvailable < 84 || heightAvailable < 38) {
      return;
    }

    const text = nodeGroup.append("text").attr("x", 10).attr("y", 22).attr("font-size", node.children ? 14 : 13).attr("font-weight", node.children ? 700 : 600);
    wrapText(text, label, widthAvailable - 16, 1);

    if (secondary && heightAvailable > 72) {
      nodeGroup
        .append("text")
        .attr("x", 10)
        .attr("y", 44)
        .attr("font-size", 11)
        .attr("fill-opacity", 0.84)
        .text(secondary);
    }
  });

  breadcrumb.textContent = "All companies · click a category to filter and a company to inspect";
  visualizationHost.appendChild(svg.node());
}

function renderRadialTree(root) {
  visualizationHost.replaceChildren();
  if (!state.filteredCompanies.length) {
    renderEmptyVisualization("No companies match the current filters.");
    breadcrumb.textContent = "No matches";
    return;
  }

  const width = visualizationHost.clientWidth || 960;
  const height = Math.max(640, Math.min(980, Math.round(width * 0.9)));
  const outerRadius = Math.min(width, height) / 2 - 48;
  const layoutRoot = root.copy();
  d3.tree().size([2 * Math.PI, outerRadius]).separation((a, b) => (a.parent === b.parent ? 1 : 1.4) / Math.max(a.depth, 1))(layoutRoot);

  const svg = d3.create("svg").attr("viewBox", [-width / 2, -height / 2, width, height]).attr("role", "presentation");
  const group = svg.append("g");

  group
    .append("g")
    .selectAll("path")
    .data(layoutRoot.links())
    .join("path")
    .attr("class", "radial-link")
    .attr("d", d3.linkRadial().angle((d) => d.x).radius((d) => d.y));

  const nodes = group
    .append("g")
    .selectAll("g")
    .data(layoutRoot.descendants().filter((node) => node.depth > 0))
    .join("g")
    .attr("class", (node) => `node radial-node ${node.children ? "node--branch radial-node--branch" : "node--leaf radial-node--leaf"}`)
    .attr("transform", (node) => `rotate(${(node.x * 180) / Math.PI - 90}) translate(${node.y},0)`)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (node) => nodeAriaLabel(node))
    .style("cursor", "pointer")
    .on("click", (_, node) => handleNodeClick(node))
    .on("keydown", (event, node) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNodeClick(node);
      }
    })
    .on("mousemove", (event, node) => showTooltip(event, node))
    .on("focus", (event, node) => showTooltip(event, node))
    .on("blur", hideTooltip)
    .on("mouseleave", hideTooltip);

  nodes
    .append("circle")
    .attr("r", (node) => (node.children ? (node.depth === 1 ? 6 : 4.5) : 3.5))
    .attr("fill", (node) => color(resolveBusinessType(node)));

  nodes
    .filter((node) => node.depth < 3 || shouldShowCompanyLabels())
    .append("text")
    .attr("dy", "0.31em")
    .attr("x", (node) => (node.x < Math.PI ? 10 : -10))
    .attr("text-anchor", (node) => (node.x < Math.PI ? "start" : "end"))
    .attr("transform", (node) => (node.x >= Math.PI ? "rotate(180)" : null))
    .attr("font-weight", (node) => (node.children ? 650 : 450))
    .text((node) => node.data.name);

  breadcrumb.textContent = "All companies · use the radial tree to follow business type → sub-type → company";
  visualizationHost.appendChild(svg.node());
}

function shouldShowCompanyLabels() {
  return state.filteredCompanies.length <= 40 || Object.values(state.filters).some(Boolean);
}

function resolveBusinessType(node) {
  const ancestor = node.ancestors().find((item) => item.depth === 1);
  return ancestor?.data?.name ?? "Other";
}

function showTooltip(event, node) {
  const isLeaf = !node.children && node.data.company;
  const title = node.data.name;
  const meta = isLeaf
    ? `${node.data.company.business_type} · ${node.data.company.sub_type[0]} · ${node.data.company.country}`
    : `${node.value} companies`;

  tooltip.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = title;
  const metaLine = document.createElement("div");
  metaLine.className = "meta-line";
  metaLine.textContent = meta;
  tooltip.append(strong, metaLine);
  tooltip.classList.remove("hidden");
  const clientX = event.clientX ?? 24;
  const clientY = event.clientY ?? 24;

  if (event.type === "focus" && event.currentTarget instanceof Element) {
    const rect = event.currentTarget.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 + 12}px`;
    tooltip.style.top = `${rect.top + 12}px`;
    return;
  }

  tooltip.style.left = `${clientX + 14}px`;
  tooltip.style.top = `${clientY + 14}px`;
}

function hideTooltip() {
  tooltip.classList.add("hidden");
}

function handleNodeClick(node) {
  if (!node.children && node.data.companyId) {
    state.selectedCompanyId = node.data.companyId;
    renderDetails();
    return;
  }

  if (node.depth === 1) {
    state.filters.businessType = node.data.name;
    state.filters.subType = "";
    inputs.businessType.value = node.data.name;
    inputs.subType.value = "";
    applyFilters();
    return;
  }

  if (node.depth === 2) {
    state.filters.businessType = node.parent.data.name;
    state.filters.subType = node.data.name;
    inputs.businessType.value = node.parent.data.name;
    inputs.subType.value = node.data.name;
    applyFilters();
  }
}

function renderDetails() {
  const company = state.filteredCompanies.find((item) => item.id === state.selectedCompanyId);
  if (!company) {
    detailsPanel.replaceChildren(createElement("p", { className: "empty-state", text: "No company selected in the current filtered set." }));
    return;
  }

  detailsPanel.replaceChildren(
    createDetailsHeader(company),
    createElement("p", { text: company.description_short }),
    createFactsGrid(company),
    createLinksSection("Official links", [
      [company.website_url, "Website"],
      [company.engineering_blog_url, "Engineering blog"],
      [company.ai_blog_url, "AI blog"],
      [company.careers_url, "Careers"]
    ]),
    createTagsSection(company.tags),
    createSourcesSection(company)
  );
}

function createDetailsHeader(company) {
  const wrapper = createElement("div", { className: "details-title-row" });
  const titleBlock = document.createElement("div");
  titleBlock.append(
    createElement("h3", { text: company.name }),
    createElement("p", { className: "meta-line", text: `${company.business_type} → ${company.sub_type.join(", ")}` })
  );
  wrapper.append(titleBlock, createElement("span", { className: "pill", text: company.country }));
  return wrapper;
}

function createFactsGrid(company) {
  const grid = createElement("div", { className: "fact-grid" });
  [
    ["Founded", company.founded_year],
    ["CEO", company.ceo],
    ["Headquarters", company.hq_city],
    ["Employee scale", company.employee_count_bucket]
  ].forEach(([label, value]) => grid.append(createFactCard(label, value)));
  return grid;
}

function createFactCard(label, value) {
  const card = createElement("article", { className: "fact-card" });
  card.append(createElement("span", { className: "fact-label", text: label }), createElement("span", { text: String(value ?? "—") }));
  return card;
}

function createLinksSection(title, links) {
  const section = document.createElement("div");
  const list = createElement("div", { className: "link-list" });
  links.forEach(([url, label]) => {
    const link = createLinkChip(url, label);
    if (link) list.append(link);
  });
  section.append(createElement("h3", { text: title }), list);
  return section;
}

function createTagsSection(tags) {
  const section = document.createElement("div");
  const list = createElement("div", { className: "tag-list" });
  tags.forEach((tag) => list.append(createElement("span", { className: "tag", text: tag })));
  section.append(createElement("h3", { text: "Field tags" }), list);
  return section;
}

function createSourcesSection(company) {
  const section = document.createElement("div");
  const list = createElement("div", { className: "link-list" });
  company.source_urls.forEach((url, index) => {
    const link = createLinkChip(url, `Source ${index + 1}`);
    if (link) list.append(link);
  });
  section.append(
    createElement("h3", { text: "Sources" }),
    list,
    createElement("p", { className: "meta-line", text: `Last verified: ${company.last_verified_at}` })
  );
  return section;
}

function createLinkChip(url, label) {
  if (!url) return null;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = label;
  return link;
}

function createElement(tagName, { className = "", text = "" } = {}) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}

function nodeAriaLabel(node) {
  if (!node.children && node.data.company) {
    const company = node.data.company;
    return `${company.name}. ${company.business_type}. ${company.sub_type[0]}. ${company.country}. Press Enter for details.`;
  }

  return `${node.data.name}. ${node.value} companies. Press Enter to filter this category.`;
}

function wrapText(textSelection, value, width, maxLines) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = [];

  words.forEach((word) => {
    currentLine.push(word);
    const provisional = currentLine.join(" ");
    const temp = textSelection.text(provisional);
    if (temp.node().getComputedTextLength() > width && currentLine.length > 1) {
      currentLine.pop();
      lines.push(currentLine.join(" "));
      currentLine = [word];
    }
  });

  if (currentLine.length) {
    lines.push(currentLine.join(" "));
  }

  textSelection.text(null);
  lines.slice(0, maxLines).forEach((line, index) => {
    textSelection
      .append("tspan")
      .attr("x", 10)
      .attr("dy", index === 0 ? 0 : 14)
      .text(line);
  });

  if (lines.length > maxLines) {
    textSelection.select("tspan:last-child").text(`${lines[maxLines - 1].slice(0, -1)}…`);
  }
}

function updateHeroStats(companies) {
  statCompanies.textContent = String(companies.length);
  statBusinessTypes.textContent = String(uniqueSorted(companies.map((company) => company.business_type)).length);
  statCountries.textContent = String(uniqueSorted(companies.map((company) => company.country)).length);
}

init().catch((error) => {
  console.error(error);
  activeSummary.textContent = "Failed to load company data.";
  renderEmptyVisualization("Failed to load company data.");
});
