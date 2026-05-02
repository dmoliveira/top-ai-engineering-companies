const DATA_URL = "data/companies.json";

const state = {
  companies: [],
  filteredCompanies: [],
  currentRoot: null,
  selectedCompanyId: null,
  viewMode: "radial",
  radialScale: 1,
  filters: {
    search: "",
    country: "",
    businessType: "",
    subType: "",
    tag: ""
  }
};

const palette = ["#5ca8ff", "#67d38a", "#a06bff", "#ffb257", "#ff6b8a", "#55d3c1", "#ff78d9", "#7aa0ff", "#98a8bf"];
const color = d3.scaleOrdinal().range(palette).unknown("#64748b");

const elements = {
  visualizationHost: document.getElementById("visualization"),
  breadcrumb: document.getElementById("breadcrumb"),
  detailsPanel: document.getElementById("details-panel"),
  activeSummary: document.getElementById("active-summary"),
  activeFilters: document.getElementById("active-filters"),
  legend: document.getElementById("legend"),
  categoryGrid: document.getElementById("category-grid"),
  relatedCompanies: document.getElementById("related-companies"),
  resultCount: document.getElementById("result-count"),
  modeIndicator: document.getElementById("mode-indicator"),
  modeLabel: document.getElementById("mode-label"),
  vizHeading: document.getElementById("viz-heading"),
  vizSubtitle: document.getElementById("viz-subtitle"),
  statCompanies: document.getElementById("stat-companies"),
  statBusinessTypes: document.getElementById("stat-business-types"),
  statCountries: document.getElementById("stat-countries"),
  clearSelection: document.getElementById("clear-selection"),
  fitView: document.getElementById("fit-view"),
  zoomIn: document.getElementById("zoom-in"),
  zoomOut: document.getElementById("zoom-out")
};

const inputs = {
  search: document.getElementById("search-input"),
  country: document.getElementById("country-select"),
  businessType: document.getElementById("business-type-select"),
  subType: document.getElementById("sub-type-select"),
  tag: document.getElementById("tag-select")
};

const viewButtons = [...document.querySelectorAll("[data-view-mode]")];
const tooltip = document.createElement("div");
tooltip.className = "tooltip hidden";
document.body.appendChild(tooltip);

let resizeTimer = null;

document.getElementById("reset-filters").addEventListener("click", resetFilters);
elements.clearSelection.addEventListener("click", clearSelection);
elements.fitView.addEventListener("click", () => {
  state.radialScale = 1;
  renderVisualization(state.currentRoot);
});
elements.zoomIn.addEventListener("click", () => {
  if (state.viewMode !== "radial") return;
  state.radialScale = Math.min(1.45, state.radialScale + 0.12);
  renderVisualization(state.currentRoot);
});
elements.zoomOut.addEventListener("click", () => {
  if (state.viewMode !== "radial") return;
  state.radialScale = Math.max(0.78, state.radialScale - 0.12);
  renderVisualization(state.currentRoot);
});

inputs.search.addEventListener("input", (event) => setSearchValue(event.target.value.trim()));

["country", "businessType", "subType", "tag"].forEach((key) => {
  inputs[key].addEventListener("change", (event) => {
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
  resizeTimer = window.setTimeout(() => renderVisualization(state.currentRoot), 140);
});

async function init() {
  const companies = await d3.json(DATA_URL);
  state.companies = companies;
  color.domain(uniqueSorted(companies.map((company) => company.business_type)));
  populateFilters(companies);
  updateHeroStats(companies);
  state.selectedCompanyId = null;
  updateViewModeUI();
  renderCategoryGrid();
  applyFilters();
}

function resetFilters() {
  state.filters = { search: "", country: "", businessType: "", subType: "", tag: "" };
  state.radialScale = 1;
  syncInputs();
  applyFilters();
}

function clearSelection() {
  state.selectedCompanyId = null;
  renderDetails();
  renderRelatedCompanies();
  renderVisualization(state.currentRoot);
}

function setSearchValue(value) {
  state.filters.search = value;
  applyFilters();
}

function syncInputs() {
  inputs.search.value = state.filters.search;
  inputs.country.value = state.filters.country;
  inputs.businessType.value = state.filters.businessType;
  inputs.subType.value = state.filters.subType;
  inputs.tag.value = state.filters.tag;
}

function populateFilters(companies) {
  fillSelect(inputs.country, uniqueSorted(companies.map((company) => company.country)), "All countries");
  fillSelect(inputs.businessType, uniqueSorted(companies.map((company) => company.business_type)), "All business types");
  fillSelect(inputs.subType, uniqueSorted(companies.flatMap((company) => company.sub_type)), "All sub-types");
  fillSelect(inputs.tag, uniqueSorted(companies.flatMap((company) => company.tags)), "All field tags");
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
    const searchText = [company.name, company.business_type, company.sub_type.join(" "), company.tags.join(" "), company.description_short, company.country]
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

  if (state.selectedCompanyId !== null && !state.filteredCompanies.some((company) => company.id === state.selectedCompanyId)) {
    state.selectedCompanyId = state.filteredCompanies[0]?.id ?? null;
  }

  state.currentRoot = buildHierarchy(state.filteredCompanies);
  syncInputs();
  renderSummary();
  renderActiveFilterChips();
  renderLegend();
  renderVisualization(state.currentRoot);
  renderDetails();
  renderRelatedCompanies();
  renderCategoryGrid();
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
    subTypeNode.children.push({ name: company.name, value: 1, companyId: company.id, company });
  });

  return d3.hierarchy(root).sum((node) => node.value || 0).sort((a, b) => b.value - a.value);
}

function renderSummary() {
  const count = state.filteredCompanies.length;
  elements.resultCount.textContent = String(count);
  elements.activeSummary.textContent = count === state.companies.length ? `${count} companies found. Use filters or click on the tree to explore.` : `${count} of ${state.companies.length} companies match the current filters.`;
}

function renderActiveFilterChips() {
  const chips = [];
  const labels = {
    search: "Search",
    businessType: "Business type",
    subType: "Sub-type",
    tag: "Field tag",
    country: "Country"
  };

  Object.entries(state.filters).forEach(([key, value]) => {
    if (value) {
      chips.push([key, `${labels[key]}: ${value}`]);
    }
  });

  elements.activeFilters.replaceChildren();
  if (!chips.length) {
    elements.activeFilters.append(createElement("span", { className: "meta-line", text: "No active filters — explore the full directory." }));
    return;
  }

  chips.forEach(([key, label]) => {
    const chip = createElement("span", { className: "filter-chip" });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${label}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.filters[key] = "";
      applyFilters();
    });
    chip.append(document.createTextNode(label), remove);
    elements.activeFilters.append(chip);
  });
}

function renderLegend() {
  const filteredCounts = countBy(state.filteredCompanies, (company) => company.business_type);
  const businessTypes = uniqueSorted(state.companies.map((company) => company.business_type));
  elements.legend.replaceChildren();
  businessTypes.forEach((businessType) => {
    const item = createElement("span", { className: "legend-item" });
    const swatch = createElement("span", { className: "legend-swatch" });
    swatch.style.background = color(businessType);
    const count = filteredCounts.get(businessType) || 0;
    item.classList.toggle("legend-item--muted", count === 0);
    item.append(swatch, document.createTextNode(`${businessType} (${count})`));
    elements.legend.append(item);
  });
}

function renderCategoryGrid() {
  const totalCounts = countBy(state.companies, (company) => company.business_type);
  const filteredCounts = countBy(state.filteredCompanies, (company) => company.business_type);
  const businessTypes = uniqueSorted(state.companies.map((company) => company.business_type));
  elements.categoryGrid.replaceChildren();

  businessTypes.forEach((businessType) => {
    const button = createElement("button", { className: "category-card-button", text: "" });
    button.type = "button";
    const filteredCount = filteredCounts.get(businessType) || 0;
    const totalCount = totalCounts.get(businessType) || 0;
    if (state.filters.businessType === businessType) button.classList.add("is-active");
    if (filteredCount === 0) button.classList.add("is-dimmed");
    button.addEventListener("click", () => {
      state.filters.businessType = businessType;
      state.filters.subType = "";
      applyFilters();
    });

    const head = createElement("div", { className: "category-head" });
    const badge = createElement("span", { className: "category-badge", text: businessType.charAt(0) });
    badge.style.background = color(businessType);
    head.append(createElement("strong", { text: businessType }), badge);
    button.append(
      head,
      createElement("p", { className: "category-meta", text: businessTypeMeta(businessType) }),
      createElement("span", { className: "category-count", text: `${filteredCount} shown • ${totalCount} total` })
    );
    elements.categoryGrid.append(button);
  });
}

function businessTypeMeta(value) {
  const map = {
    AI: "Research & platforms",
    "Big Tech": "Scale product ecosystems",
    "Cloud and Infrastructure": "Infra & cloud platforms",
    "Developer Tools": "Builders and workflows",
    Fintech: "Payments & finance tech",
    "Mobility and Logistics": "Real-time networks",
    "Enterprise Software": "Business platforms",
    "Health and Bio": "Clinical & genomics",
    "Semiconductors and Compute": "Accelerated compute"
  };
  return map[value] || "Top technology companies";
}

function updateViewModeUI() {
  const isRadial = state.viewMode === "radial";
  elements.modeIndicator.textContent = isRadial ? "◎" : "▦";
  elements.modeLabel.textContent = isRadial ? "Radial" : "Treemap";
  elements.vizHeading.textContent = "Explore Companies";
  elements.vizSubtitle.textContent = isRadial ? "Interactive radial tree • Click nodes to explore" : "Interactive treemap • Click tiles to explore";
  viewButtons.forEach((button) => {
    const active = button.dataset.viewMode === state.viewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const zoomDisabled = !isRadial;
  elements.zoomIn.disabled = zoomDisabled;
  elements.zoomOut.disabled = zoomDisabled;
}

function renderVisualization(root) {
  if (!root) {
    renderEmptyVisualization("Loading company directory…");
    return;
  }
  if (state.viewMode === "radial") {
    renderRadialTree(root);
  } else {
    renderTreemap(root);
  }
}

function renderEmptyVisualization(message) {
  const empty = createElement("div", { className: "empty-state", text: message });
  empty.style.padding = "1rem";
  elements.visualizationHost.replaceChildren(empty);
}

function renderTreemap(root) {
  elements.visualizationHost.replaceChildren();
  if (!state.filteredCompanies.length) {
    renderEmptyVisualization("No companies match the current filters.");
    elements.breadcrumb.textContent = "No matches";
    return;
  }

  const width = elements.visualizationHost.clientWidth || 960;
  const height = Math.max(480, Math.min(740, Math.round(width * 0.6)));
  d3.treemap().size([width, height]).paddingOuter(8).paddingTop((node) => (node.depth < 2 ? 30 : 18)).paddingInner(4)(root);
  const svg = d3.create("svg").attr("viewBox", [0, 0, width, height]).attr("role", "presentation");
  const group = svg.append("g");
  const nodes = group
    .selectAll("g")
    .data(root.descendants().filter((node) => node.depth > 0))
    .join("g")
    .attr("class", (node) => `node ${node.children ? "node--branch" : "node--leaf"} ${node.data.companyId === state.selectedCompanyId ? "node--selected" : ""}`)
    .attr("transform", (node) => `translate(${node.x0},${node.y0})`)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (node) => nodeAriaLabel(node))
    .style("cursor", "pointer")
    .on("click", (_, node) => handleNodeClick(node))
    .on("keydown", (event, node) => keyboardSelect(event, node))
    .on("mousemove", (event, node) => showTooltip(event, node))
    .on("focus", (event, node) => showTooltip(event, node))
    .on("blur", hideTooltip)
    .on("mouseleave", hideTooltip);

  nodes
    .append("rect")
    .attr("width", (node) => Math.max(0, node.x1 - node.x0))
    .attr("height", (node) => Math.max(0, node.y1 - node.y0))
    .attr("rx", 14)
    .attr("fill", (node) => color(resolveBusinessType(node)))
    .attr("opacity", (node) => (node.children ? 0.76 - node.depth * 0.06 : 0.94));

  nodes.each(function drawLabels(node) {
    const nodeGroup = d3.select(this);
    const widthAvailable = node.x1 - node.x0;
    const heightAvailable = node.y1 - node.y0;
    if (widthAvailable < 92 || heightAvailable < 42) return;
    const title = nodeGroup.append("text").attr("x", 12).attr("y", 22).attr("font-size", node.children ? 14 : 12.5).attr("font-weight", node.children ? 700 : 600);
    wrapText(title, node.data.name, widthAvailable - 18, 1);
    if (!node.children && heightAvailable > 72) {
      nodeGroup.append("text").attr("x", 12).attr("y", 44).attr("font-size", 11).attr("fill-opacity", 0.82).text(`${node.data.company.country} · ${node.data.company.sub_type[0]}`);
    }
  });

  elements.breadcrumb.textContent = "All companies · click a category to focus and a company to inspect";
  elements.visualizationHost.appendChild(svg.node());
}

function renderRadialTree(root) {
  elements.visualizationHost.replaceChildren();
  if (!state.filteredCompanies.length) {
    renderEmptyVisualization("No companies match the current filters.");
    elements.breadcrumb.textContent = "No matches";
    return;
  }

  const width = elements.visualizationHost.clientWidth || 960;
  const height = Math.max(540, Math.min(780, Math.round(width * 0.76)));
  const outerRadius = Math.min(width, height) / 2 - 58;
  const layoutRoot = root.copy();
  d3.tree().size([2 * Math.PI, outerRadius]).separation((a, b) => (a.parent === b.parent ? 1 : 1.35) / Math.max(a.depth, 1))(layoutRoot);

  const svg = d3.create("svg").attr("viewBox", [-width / 2, -height / 2, width, height]).attr("role", "presentation");
  const defs = svg.append("defs");
  defs
    .append("filter")
    .attr("id", "radial-node-glow")
    .attr("x", "-60%")
    .attr("y", "-60%")
    .attr("width", "220%")
    .attr("height", "220%")
    .html(`
      <feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"></feColorMatrix>
      <feMerge>
        <feMergeNode></feMergeNode>
        <feMergeNode in="SourceGraphic"></feMergeNode>
      </feMerge>
    `);

  const group = svg.append("g").attr("transform", `scale(${state.radialScale})`);
  const ringCount = 5;
  const rings = d3.range(1, ringCount + 1).map((index) => (outerRadius / ringCount) * index);

  group
    .append("g")
    .attr("class", "radial-grid")
    .selectAll("circle")
    .data(rings)
    .join("circle")
    .attr("class", "radial-guide-ring")
    .attr("r", (radius) => radius);

  group
    .append("g")
    .attr("class", "radial-axes")
    .selectAll("line")
    .data(layoutRoot.children ?? [])
    .join("line")
    .attr("class", "radial-axis")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", (node) => Math.cos(node.x - Math.PI / 2) * (outerRadius + 10))
    .attr("y2", (node) => Math.sin(node.x - Math.PI / 2) * (outerRadius + 10));

  const centerHub = group.append("g").attr("class", "radial-center-hub");
  centerHub.append("circle").attr("class", "radial-center-glow").attr("r", Math.max(outerRadius * 0.18, 54));
  centerHub.append("circle").attr("class", "radial-center-ring radial-center-ring--outer").attr("r", 32);
  centerHub.append("circle").attr("class", "radial-center-ring radial-center-ring--inner").attr("r", 20);
  centerHub.append("text").attr("class", "radial-center-label").attr("text-anchor", "middle").attr("dy", "0.34em").text(centerHubLabel(root));

  group
    .append("g")
    .selectAll("path")
    .data(layoutRoot.links())
    .join("path")
    .attr("class", (link) => `radial-link radial-link--depth-${link.target.depth}`)
    .attr("d", d3.linkRadial().angle((d) => d.x).radius((d) => d.y));

  const nodes = group
    .append("g")
    .selectAll("g")
    .data(layoutRoot.descendants().filter((node) => node.depth > 0))
    .join("g")
    .attr(
      "class",
      (node) =>
        `radial-node radial-node--depth-${node.depth} ${node.children ? "node--branch" : "node--leaf"} ${
          node.data.companyId === state.selectedCompanyId ? "radial-node--selected" : ""
        }`
    )
    .attr("transform", (node) => `rotate(${(node.x * 180) / Math.PI - 90}) translate(${node.y},0)`)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (node) => nodeAriaLabel(node))
    .style("cursor", "pointer")
    .on("click", (_, node) => handleNodeClick(node))
    .on("keydown", (event, node) => keyboardSelect(event, node))
    .on("mousemove", (event, node) => showTooltip(event, node))
    .on("focus", (event, node) => showTooltip(event, node))
    .on("blur", hideTooltip)
    .on("mouseleave", hideTooltip);

  nodes
    .append("circle")
    .attr("class", "radial-node-halo")
    .attr("r", (node) => haloRadius(node))
    .attr("fill", (node) => color(resolveBusinessType(node)))
    .attr("opacity", (node) => haloOpacity(node));

  nodes
    .append("circle")
    .attr("class", "radial-node-core")
    .attr("r", (node) => coreRadius(node))
    .attr("fill", (node) => nodeFill(node))
    .attr("filter", (node) => (node.depth <= 1 || node.data.companyId === state.selectedCompanyId ? "url(#radial-node-glow)" : null));

  nodes
    .filter((node) => node.depth < 3 || shouldShowCompanyLabels())
    .append("text")
    .attr("class", (node) => `radial-label radial-label--depth-${node.depth}`)
    .attr("dy", "0.31em")
    .attr("x", (node) => (node.x < Math.PI ? 11 : -11))
    .attr("text-anchor", (node) => (node.x < Math.PI ? "start" : "end"))
    .attr("transform", (node) => (node.x >= Math.PI ? "rotate(180)" : null))
    .attr("font-weight", (node) => (node.children ? 680 : 440))
    .text((node) => radialLabel(node));

  elements.breadcrumb.textContent = "All companies · follow business type → sub-type → company";
  elements.visualizationHost.appendChild(svg.node());
}

function shouldShowCompanyLabels() {
  return state.filteredCompanies.length <= 28 || Object.values(state.filters).some(Boolean);
}

function keyboardSelect(event, node) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleNodeClick(node);
  }
}

function resolveBusinessType(node) {
  const ancestor = node.ancestors().find((item) => item.depth === 1);
  return ancestor?.data?.name ?? "Other";
}

function coreRadius(node) {
  if (node.depth === 1) return 8;
  if (node.depth === 2) return 5.2;
  return node.data.companyId === state.selectedCompanyId ? 4.8 : 3.2;
}

function haloRadius(node) {
  return coreRadius(node) + (node.depth === 1 ? 8 : node.depth === 2 ? 4.4 : 3.6);
}

function haloOpacity(node) {
  if (node.data.companyId === state.selectedCompanyId) return 0.4;
  if (node.depth === 1) return 0.22;
  if (node.depth === 2) return 0.15;
  return 0.08;
}

function nodeFill(node) {
  const base = d3.color(color(resolveBusinessType(node)));
  if (!base) return color(resolveBusinessType(node));
  if (node.depth === 1) return base.brighter(0.4).formatHex();
  if (node.depth === 2) return base.formatHex();
  return base.copy({ opacity: 1 }).brighter(node.data.companyId === state.selectedCompanyId ? 0.35 : -0.15).formatHex();
}

function radialLabel(node) {
  const maxLength = node.depth === 1 ? 20 : node.depth === 2 ? 18 : 14;
  return trimLabel(node.data.name, maxLength);
}

function trimLabel(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function centerHubLabel(root) {
  return root?.data?.name === "All companies" ? "Companies" : trimLabel(root?.data?.name ?? "Directory", 10);
}

function showTooltip(event, node) {
  const isLeaf = !node.children && node.data.company;
  const meta = isLeaf ? `${node.data.company.business_type} · ${node.data.company.sub_type[0]} · ${node.data.company.country}` : `${node.value} companies`;
  tooltip.replaceChildren();
  tooltip.append(createElement("strong", { text: node.data.name }), createElement("div", { className: "meta-line", text: meta }));
  tooltip.classList.remove("hidden");

  let left = (event.clientX ?? 24) + 14;
  let top = (event.clientY ?? 24) + 14;
  if (event.type === "focus" && event.currentTarget instanceof Element) {
    const rect = event.currentTarget.getBoundingClientRect();
    left = rect.left + rect.width / 2 + 12;
    top = rect.top + 12;
  }

  const maxLeft = window.innerWidth - 280;
  const maxTop = window.innerHeight - 120;
  tooltip.style.left = `${Math.max(12, Math.min(left, maxLeft))}px`;
  tooltip.style.top = `${Math.max(12, Math.min(top, maxTop))}px`;
}

function hideTooltip() {
  tooltip.classList.add("hidden");
}

function handleNodeClick(node) {
  if (!node.children && node.data.companyId) {
    state.selectedCompanyId = node.data.companyId;
    renderDetails();
    renderRelatedCompanies();
    renderVisualization(state.currentRoot);
    return;
  }

  if (node.depth === 1) {
    state.filters.businessType = node.data.name;
    state.filters.subType = "";
    applyFilters();
    return;
  }

  if (node.depth === 2) {
    state.filters.businessType = node.parent.data.name;
    state.filters.subType = node.data.name;
    applyFilters();
  }
}

function renderDetails() {
  const company = state.filteredCompanies.find((item) => item.id === state.selectedCompanyId) || state.companies.find((item) => item.id === state.selectedCompanyId);
  elements.clearSelection.disabled = !company;
  if (!company) {
    elements.detailsPanel.replaceChildren(createElement("p", { className: "empty-state", text: "Select a company from the visualization to inspect its facts, engineering blogs, and official links." }));
    return;
  }

  const hero = createElement("section", { className: "company-hero" });
  const avatar = createElement("div", { className: "company-avatar", text: initials(company.name) });
  const copy = document.createElement("div");
  copy.append(
    createElement("h3", { text: company.name }),
    createElement("div", { className: "pill-row" }),
    createElement("div", { className: "company-mini-meta" }),
    createElement("p", { className: "company-description", text: company.description_short })
  );
  copy.querySelector(".pill-row").append(createElement("span", { className: "pill", text: `${company.business_type}` }), createElement("span", { className: "pill", text: company.sub_type[0] }));
  copy.querySelector(".company-mini-meta").append(document.createTextNode(`${company.hq_city}, ${company.country}`), document.createTextNode("•"), document.createTextNode(company.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")));
  hero.append(avatar, copy);

  const facts = createElement("div", { className: "inspector-grid" });
  [["Founded", company.founded_year], ["CEO", company.ceo], ["Employees", company.employee_count_bucket], ["HQ", company.hq_city]].forEach(([label, value]) => {
    const row = createElement("div", { className: "fact-row" });
    row.append(createElement("span", { className: "fact-label", text: label }), createElement("strong", { text: String(value) }));
    facts.append(row);
  });

  const links = createElement("div", { className: "link-list" });
  [[company.website_url, "Website"], [company.engineering_blog_url, "Engineering blog"], [company.ai_blog_url, "AI blog"], [company.careers_url, "Careers"]].forEach(([url, label]) => {
    const link = createLinkChip(url, label);
    if (link) links.append(link);
  });

  const sourceSection = createElement("div", {});
  const sources = createElement("div", { className: "link-list" });
  company.source_urls.forEach((url, index) => {
    const link = createLinkChip(url, `Source ${index + 1}`);
    if (link) sources.append(link);
  });
  sourceSection.append(createElement("h3", { text: "Sources" }), sources, createElement("p", { className: "meta-line", text: `Last verified: ${company.last_verified_at}` }));

  const profileButton = createPrimaryLink(companyPageUrl(company.id), "View Full Profile", { external: false });
  const tags = createElement("div", { className: "tag-list" });
  company.tags.forEach((tag) => tags.append(createElement("span", { className: "tag", text: tag })));

  elements.detailsPanel.replaceChildren(hero, profileButton, facts, createSection("Official links", links), createSection("Field tags", tags), sourceSection);
}

function renderRelatedCompanies() {
  const selected = state.companies.find((company) => company.id === state.selectedCompanyId);
  elements.relatedCompanies.replaceChildren();
  if (!selected) {
    elements.relatedCompanies.append(createElement("p", { className: "empty-state", text: "Select a company to see related organizations." }));
    return;
  }

  const relatedPool = state.filteredCompanies.length ? state.filteredCompanies : state.companies;
  const related = relatedPool
    .filter((company) => company.id !== selected.id)
    .map((company) => ({
      company,
      score:
        (company.business_type === selected.business_type ? 2 : 0) +
        (company.sub_type[0] === selected.sub_type[0] ? 2 : 0) +
        (company.country === selected.country ? 1 : 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.company.name.localeCompare(b.company.name))
    .slice(0, 5)
    .map((item) => item.company);

  related.forEach((company) => {
    const item = createElement("article", { className: "related-item" });
    const contentButton = document.createElement("button");
    contentButton.type = "button";
    contentButton.addEventListener("click", () => {
      state.selectedCompanyId = company.id;
      renderDetails();
      renderRelatedCompanies();
      renderVisualization(state.currentRoot);
    });
    contentButton.append(createElement("h3", { text: company.name }), createElement("p", { className: "meta-line", text: `${company.sub_type[0]} • ${company.country}` }));
    const pageLink = document.createElement("a");
    pageLink.href = companyPageUrl(company.id);
    pageLink.className = "pill related-page-link";
    pageLink.textContent = "Open page";
    item.append(contentButton, pageLink);
    elements.relatedCompanies.append(item);
  });

  if (!related.length) {
    elements.relatedCompanies.append(createElement("p", { className: "empty-state", text: "No close matches found for the current company." }));
  }
}

function createSection(title, contentNode) {
  const section = document.createElement("section");
  section.append(createElement("h3", { text: title }), contentNode);
  return section;
}

function createPrimaryLink(url, label, { external = true } = {}) {
  if (!url) return createElement("span", { className: "primary-button", text: label });
  const link = document.createElement("a");
  link.className = "primary-button";
  link.href = url;
  if (external) {
    link.target = "_blank";
    link.rel = "noreferrer";
  }
  link.textContent = label;
  return link;
}

function companyPageUrl(companyId) {
  return `companies/${companyId}/`;
}

function createLinkChip(url, label) {
  if (!url) return null;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.className = "pill";
  link.textContent = label;
  return link;
}

function createElement(tagName, { className = "", text = "" } = {}) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function countBy(items, keyFn) {
  const counts = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
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
  if (currentLine.length) lines.push(currentLine.join(" "));
  textSelection.text(null);
  lines.slice(0, maxLines).forEach((line, index) => {
    textSelection.append("tspan").attr("x", 12).attr("dy", index === 0 ? 0 : 14).text(line);
  });
  if (lines.length > maxLines) {
    textSelection.select("tspan:last-child").text(`${lines[maxLines - 1]}…`);
  }
}

function updateHeroStats(companies) {
  elements.statCompanies.textContent = String(companies.length);
  elements.statBusinessTypes.textContent = String(uniqueSorted(companies.map((company) => company.business_type)).length);
  elements.statCountries.textContent = String(uniqueSorted(companies.map((company) => company.country)).length);
}

init().catch((error) => {
  console.error(error);
  elements.activeSummary.textContent = "Failed to load company data.";
  renderEmptyVisualization("Failed to load company data.");
});
