import { fetchOperatorData, fetchRecruitmentData } from "./api.js";
import { saveToDB, getFromDB, isLocalDataOutdated } from "./db.js";
import { filterOperators } from "./recruitment.js";
import { toastNotification } from "./toast.js";

const maxTags = 5;
let selectedTags = { // Store selected tags by category
	"rarity": new Set(), 
	"position": new Set(), 
	"profession": new Set(), 
	"tagList": new Set()
}; 

let characterData = null;
let recruitmentData = null;
let allTags = [];
let fetchedTags = new Set(); // Tracks fetched tags
let cachedOperators = new Map(); // Store unique operators
let currentSections = new Map(); // Store current sections for toggling
let deferredPrompt;
let isPWAInstalled = false;

let TAG_CATEGORIES = {
	Qualification: [28, 17, 14, 11],
	Position: [9, 10],
	Class: [8, 1, 3, 2, 6, 4, 5, 7], // Profession
	Specialization: [],
};

const CATEGORIES_MAP = {
	"Qualification": "rarity",
	"Position": "position",
	"Class": "profession",
	"Specialization": "tagList"
}

async function loadTag() {
	recruitmentData = await fetchRecruitmentData();
	let tags = recruitmentData.tags.data || [];
	populateTags(tags);
	characterData = await fetchOperatorData();
}

function populateTags(tags) {
	allTags = tags;
	const container = document.getElementById("tag-selection");
	container.innerHTML = "";

	// Create a map to store tags by category
	const categorizedTags = {
		Qualification: [],
		Position: [],
		Class: [],
		Specialization: []
	};

	// Categorize tags
	tags.forEach(tag => {
		// Skip Female & Male tags
		if (tag.orderNum === 1012 || tag.orderNum === 1013) return;
		let found = false;
		for (const category in TAG_CATEGORIES) {
			if (TAG_CATEGORIES[category].includes(tag.orderNum)) {
				categorizedTags[category].push(tag);
				found = true;
				break;
			}
		}
		if (!found) {
			categorizedTags.Specialization.push(tag);
		}
	});
	// Sort Specialization tags by name
	const locale = navigator.language.substring(0,2) || 'zh'; // fallback to 'en' if unavailable
	console.log("Sorting Specialization tags by name in locale:", locale);
	console.log("Categorized Tags:", categorizedTags.Specialization);
	categorizedTags.Specialization.sort((a, b) =>
		a['name'][locale]?.localeCompare(b['name'][locale], locale) ??
		a['name']['zh']?.localeCompare(b['name']['zh']) // fallback if field is missing
	);

	// Create tag-category divider
	const categoryDivider = document.createElement("hr");
	categoryDivider.className = "tag-category-divider";

	// Create tag-category divs
	let isFirstTag = true; // Flag to check if it's the first iteration
	for (const category in categorizedTags) {
		const categoryDiv = document.createElement("div")
		categoryDiv.className = "tag-category";

		const categoryHeader = document.createElement("div");
		categoryHeader.className = "tag-category-header";

		const categoryTitle = document.createElement("span");
		categoryTitle.className = "tag-category-name";
		categoryTitle.textContent = category;

		categoryHeader.appendChild(categoryTitle);
		categoryHeader.appendChild(categoryDivider.cloneNode(true));

		categoryDiv.appendChild(categoryHeader);

		const tagList = document.createElement("ul");
		tagList.className = "tag-list";
		tagList.role = "listbox";
		tagList.setAttribute("aria-label", category);
		tagList.setAttribute("aria-multiselectable", "true");
		categorizedTags[category].forEach(tag => {
			const listItem = document.createElement("li");
			listItem.className = "tag-item";
			listItem.setAttribute("role", "checkbox");
			listItem.setAttribute("aria-checked", "false");
			listItem.setAttribute("aria-checked", "false");
			listItem.setAttribute("tabindex", "-1");
			if (isFirstTag) {
				listItem.setAttribute("tabindex", "0");
				isFirstTag = false; // Set to false after the first iteration
			}
			listItem.setAttribute("aria-labelledby", tag.name.zh);

			const input = document.createElement("input");
			input.className = "checkbox-input";
			input.type = "checkbox";
			input.name = category;
			input.id = tag.id;
			input.dataset.cnText = tag.name_zh;
			input.hidden = true;

			const itemContainer = document.createElement("div");
			itemContainer.className = "tag-item-container";

			const span = document.createElement("span");
			span.className = "tag-item-name";
			span.textContent = tag.name.en || tag.name.zh;
			itemContainer.appendChild(span);

			listItem.appendChild(input);
			listItem.appendChild(itemContainer);
			tagList.appendChild(listItem);
		});
		categoryDiv.appendChild(tagList);
		container.appendChild(categoryDiv);
	}

    const allTagsElements = Array.from(container.querySelectorAll(".tag-item"));
    const resetFilterState = setupKeyboardNavigation(allTagsElements);

    function clearTagInputOnly() {
        const inputForm = document.getElementById("tag-input-form");
        const input = inputForm.querySelector("#tag-input");
        input.value = "";
        allTagsElements.forEach(tag => tag.classList.remove("highlighted", "active-highlight"));
        resetFilterState();
    }
	// Event delegation for keyboard navigation
	container.addEventListener("keydown", (e) => {
		const activeElement = document.activeElement;

		if (!activeElement.classList.contains("tag-item")) return;

		const currentTag = activeElement;
		const currentList = currentTag.closest('.tag-list');
		const currentCategory = currentTag.closest('.tag-category');

		let nextTag = null;
		if (e.key === 'ArrowRight') {
			// Move to next tag in the same category
			nextTag = currentTag.nextElementSibling;
			while (nextTag && !nextTag.classList.contains('tag-item')) {
				nextTag = nextTag.nextElementSibling;
			}
		} else if (e.key === 'ArrowLeft') {
			// Move to previous tag in the same category
			nextTag = currentTag.previousElementSibling;
			while (nextTag && !nextTag.classList.contains('tag-item')) {
				nextTag = nextTag.previousElementSibling;
			}
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			// Move vertically between categories

			// First: find the index of the current item in its list
			const tagsInCurrentList = Array.from(currentList.querySelectorAll('.tag-item'));
			const currentIndex = tagsInCurrentList.indexOf(currentTag);

			let siblingCategory = null;
			if (e.key === 'ArrowDown') {
				// Next category
				siblingCategory = currentCategory.nextElementSibling;
				while (siblingCategory && !siblingCategory.classList.contains('tag-category')) {
					siblingCategory = siblingCategory.nextElementSibling;
				}
			} else if (e.key === 'ArrowUp') {
				// Previous category
				siblingCategory = currentCategory.previousElementSibling;
				while (siblingCategory && !siblingCategory.classList.contains('tag-category')) {
					siblingCategory = siblingCategory.previousElementSibling;
				}
			}

			if (siblingCategory) {
				const siblingList = siblingCategory.querySelector('.tag-list');
				if (siblingList) {
					const tagsInSiblingList = Array.from(siblingList.querySelectorAll('.tag-item'));
					if (tagsInSiblingList.length > 0) {
						// Try to focus the tag in the same position, or fallback to the last one
						nextTag = tagsInSiblingList[Math.min(currentIndex, tagsInSiblingList.length - 1)];
					}
				}
			}
		} else if (e.key === 'Enter') {
			// Trigger click on the current tag
			e.preventDefault();
			currentTag.click();
		}
		if (nextTag) {
			e.preventDefault();
			currentTag.setAttribute('tabindex', '-1');
			nextTag.setAttribute('tabindex', '0');
			nextTag.focus();
		}
	});
	// Event delegation for clicks
	container.addEventListener("click", (e) => {
		const li = e.target.closest(".tag-item");
		if (!li || li.getAttribute("aria-disabled") === "true") return;

		const checkbox = li.querySelector("input[type='checkbox']");
		if (!checkbox) return;

		checkbox.checked = !checkbox.checked;
		checkbox.dispatchEvent(new Event("change", { bubbles: true }));
	});
	// Handle checkbox logic
	container.addEventListener("change", (event) => {
		if (!event.target.matches("input[type='checkbox']")) return;

		let changeSuccess = false;
		if (event.target.checked) {
			const allSelectedTags = Object.values(selectedTags).reduce((sum, set) => sum + set.size, 0);
			if (allSelectedTags < maxTags) {
				selectedTags[CATEGORIES_MAP[event.target.name]].add(event.target.id);
				changeSuccess = true; // Successfully added tag
			} else {
				event.target.checked = false;
				toastNotification(`You can only select up to ${maxTags} tags.`, {
					autoDismiss: 3000,
				});
				return;
			}
		} else {
			selectedTags[CATEGORIES_MAP[event.target.name]].delete(event.target.id);
			fetchedTags.delete(event.target.id); // Remove from fetched tags
			changeSuccess = true; // Successfully removed tag
		}
		updateTagsState(container, allTagsElements);
		updateOperators();
		if (changeSuccess) {
			clearTagInputOnly(); // Clear input only if tag state changed
			console.log(`Tag ${event.target.id} ${event.target.checked ? 'added' : 'removed'}.`);
		}
	});
}

function setupKeyboardNavigation(allTagsElements) {
	let filteredTags = []
	let currentIndex = 0;
	console.log("Setting up keyboard navigation for tags");
	const inputForm = document.getElementById("tag-input-form");
	const input = inputForm.querySelector("#tag-input");

    function resetFilterState() {
        filteredTags = [];
        allTagsElements.forEach(tag => tag.classList.remove("highlighted", "active-highlight"));
    }

	inputForm.addEventListener("submit", (e) => e.preventDefault());


	// Highlight + keyboard
	input.addEventListener("input", () => {
		if (!input.value) {
			resetFilterState();
			return;
		}
		const filter = input.value.toLowerCase();
		filteredTags = allTagsElements.filter(tag =>
			tag.innerText.toLowerCase().startsWith(filter)
		);
		console.log("Filtered Tags:", filteredTags.map(tag => tag.innerText).join(", "));

		allTagsElements.forEach(tag => tag.classList.remove("highlighted", "active-highlight"));
		if (filteredTags.length > 0) {
			currentIndex = 0;
			filteredTags.forEach(tag => tag.classList.add("highlighted"));
			filteredTags[currentIndex].classList.add("active-highlight");
		}
	});

	input.addEventListener("focus", () => {
		const filter = input.value.toLowerCase().trim();
		if (!filter) return; // skip if input is empty
		filteredTags = allTagsElements.filter(tag =>
			tag.innerText.toLowerCase().startsWith(filter)
		);
		if (filteredTags.length > 0) {
			currentIndex = 0;
			filteredTags.forEach(tag => tag.classList.add("highlighted"));
			filteredTags[currentIndex].classList.add("active-highlight");
		}
	});

	input.addEventListener("blur", resetFilterState);

	input.addEventListener("keydown", (e) => {
		if (filteredTags.length === 0) return;
		if (e.key === "Tab") {
			e.preventDefault();
			filteredTags[currentIndex].classList.remove("active-highlight");
			console.log(`Tab pressed, moving to next tag ${filteredTags[currentIndex].innerText}`);
			currentIndex = (currentIndex + 1) % filteredTags.length;
			filteredTags[currentIndex].classList.add("active-highlight");
		}
		if (e.key === "Enter") {
			if (!input.value.trim() || filteredTags.length === 0) {
				e.preventDefault();
				return;
			}
			e.preventDefault();
			const selectedTag = filteredTags[currentIndex];
			if (selectedTag && selectedTag.getAttribute("aria-disabled") !== "true") {
				selectedTag.click();
			}
		}

		if (e.key === "Escape") {
			e.preventDefault();
			console.log("Escape pressed, clearing input and tags");
			input.value = "";
			resetFilterState();
			allTagsElements.forEach(tag => {
				const checkbox = tag.querySelector('input[type="checkbox"]');
				if (checkbox && checkbox.checked) {
					checkbox.checked = false;
					checkbox.dispatchEvent(new Event("change", { bubbles: true }));
				}
			});
		}
	});
	return resetFilterState;
}

function updateTagsState(container, allTagsElements) {
	const input = document.getElementById("tag-input")
	const reachedMax = selectedTags.size >= maxTags;

	container.classList.toggle('limit-reached', reachedMax);
	input.disabled = reachedMax;
    allTagsElements.forEach(tag => {
        const checkbox = tag.querySelector("input[type='checkbox']");
        if (!checkbox.checked) {
            tag.setAttribute("aria-disabled", reachedMax);
            tag.classList.toggle("disabled", reachedMax);
        } else {
            tag.setAttribute("aria-disabled", false);
            tag.classList.remove("disabled");
        }
        tag.setAttribute("aria-checked", checkbox.checked);
    });
}

function clearTagInputOnly() {
    const inputForm = document.getElementById("tag-input-form");
    const input = inputForm.querySelector("#tag-input");
    input.value = "";
	allTagsElements.forEach(tag => tag.classList.remove("highlighted", "active-highlight"));
}

function getSectionKey(tags) {
	return Array.isArray(tags) ? tags.sort().join('-') : tags;
}

async function updateOperators() {
	const operatorResults = document.getElementById("recruitment-list");
	operatorResults.style.minHeight = `${operatorResults.offsetHeight}px`;

	let missingTags = [];

	// Identify which tags haven't been fetched yet
	Object.values(selectedTags).forEach(tagSet => {
		tagSet.forEach(tagId => {
			if (fetchedTags.has(tagId)) return; // Skip if tag is already fetched
			fetchedTags.add(tagId); // Mark tag as fetched
			missingTags.push(tagId);
		});
	});

	// Fetch only missing tags
	if (missingTags.length > 0) {
		console.log("Fetching missing tags:", missingTags);
		let fetchedOperators = [];
		const convertedMissingTags = Object.fromEntries(
			Object.entries(selectedTags).map(([key, set]) => [key, [...set]])
		);
		console.log("Converted Missing Tags:", convertedMissingTags);
		fetchedOperators = filterOperators(characterData, { all: {}, any: convertedMissingTags });

		console.log("Matched:", fetchedOperators.length);
		console.table(fetchedOperators.map(c => ({
			name: c.name,
			rarity: c.rarity,
			profession: c.profession,
			position: c.position,
			tags: c.tagList,
			powers: c.powers
		})));

		// Store operators uniquely in a Map (keyed by `id`)
		fetchedOperators.forEach(op => cachedOperators.set(op.id, op));
	}

	// Convert Set to Array before using .every()
	let selectedTagArray = Object.values(selectedTags).flatMap(set => [...set]);

	displayResults();
	cachedOperators.clear(); // Clear cached operators after displaying results
	operatorResults.style.minHeight = "";
}

function displayResults() {
	const operatorResults = document.getElementById("recruitment-list");
	let containerElement = operatorResults.querySelector('.recruitment-list-container');

	// Clear container if no tags selected
	const allSelectedTags = Object.values(selectedTags).reduce((sum, set) => sum + set.size, 0);
	if (allSelectedTags === 0) {
		containerElement.innerHTML = "";
		return;
	}

	if (!containerElement) {
		containerElement = document.createElement("div");
		containerElement.className = "recruitment-list-container";
		operatorResults.appendChild(containerElement);
	};

	let newSections = new Map();

	// Calculate which sections should be visible
	Object.values(selectedTags).forEach(tagSet => {
		tagSet.forEach(tagId => {
			const tag = allTags.find(t => t.id === tagId);
			const key = getSectionKey(tag.name.en || tag.name.zh);
			if (!currentSections.has(key)) {
				// Create section only if it doesn't exist
				const section = createSection({
					title: tag.name.en || tag.name.zh,
					tagIds: tagId,
					allowRarity6: tag.orderNum === 11
				});
				currentSections.set(key, section);
			}
			newSections.set(key, currentSections.get(key));
		})
	});

	// Handle combinations
	const tagArray = Object.values(selectedTags).flatMap(set => [...set]);;
	for (let i = 1; i < (1 << tagArray.length); i++) {
		const combination = tagArray.filter((_, index) => i & (1 << index));
		if (combination.length < 2) continue;

		const combinationNames = combination.map(tagId =>
			allTags.find(t => t.id === tagId).name.en || allTags.find(t => t.id === tagId).name.zh);
		const key = getSectionKey(combinationNames);
		
		if (!currentSections.has(key)) {
			// Create combination section only if it doesn't exist
			const section = createSection({
				title: combinationNames,
				tagIds: combination,
				allowRarity6: combination.includes("TIER_6")
			});
			currentSections.set(key, section);
		}
		newSections.set(key, currentSections.get(key));
	};

	// Remove sections that are no longer needed
	Array.from(containerElement.children).forEach(section => {
		const key = section.dataset.sectionKey;
		if (!newSections.has(key)) {
			section.remove();
		}
	});

	// Add sections that aren't in the DOM
	newSections.forEach((section, key) => {
		if (!containerElement.querySelector(`[data-section-key="${key}"]`) && section !== null) {
			containerElement.appendChild(section);
		}
	});

	// Sort sections in DOM
	const sortedSections = Array.from(containerElement.children);
	sortedSections.sort((a, b) => {
		return compareSections(a, b);
		console.log(`Comparing sections "${a.dataset.sectionKey}" and "${b.dataset.sectionKey}": ${reason}`);
		return result;
	});
	sortedSections.forEach(section => containerElement.appendChild(section));
}

function compareSectionsDebug(sectionA, sectionB) {
  const g = s => Array.from(s.querySelectorAll('.operator')).map(op => +op.dataset.rarity);
  const a = g(sectionA), b = g(sectionB);

  const maxA = Math.max(...a), maxB = Math.max(...b);
  const minA = Math.min(...a), minB = Math.min(...b);
  const lowA = a.some(r => r === 2 || r === 3), lowB = b.some(r => r === 2 || r === 3);
  const pureA = new Set(a).size === 1, pureB = new Set(b).size === 1;

  if (lowA && !lowB) return { result: 1, reason: 'Rule 1: Section A has rarity 2/3, loses to section without' };
  if (lowB && !lowA) return { result: -1, reason: 'Rule 1: Section B has rarity 2/3, loses to section without' };

  if (pureA && pureB) {
    if (maxA !== maxB) return { result: maxB - maxA, reason: `Rule 2: Both pure, higher rarity wins (${maxA} vs ${maxB})` };
    return { result: a.length - b.length, reason: `Rule 2b: Both pure, same rarity, fewer operators wins (${a.length} vs ${b.length})` };
  }

  if (!pureA && !pureB) {
    if (maxA !== maxB) return { result: maxB - maxA, reason: `Rule 3: Both mixed, higher max wins (${maxA} vs ${maxB})` };
    if (minA !== minB) return { result: minB - minA, reason: `Rule 3b: Both mixed, same max, higher min wins (${minA} vs ${minB})` };
    const minCountA = a.filter(r => r === minA).length;
    const minCountB = b.filter(r => r === minB).length;
    if (minCountA !== minCountB) return { result: minCountA - minCountB, reason: `Rule 3c: Both mixed, same max & min, fewer min-rarity operators wins (${minCountA} vs ${minCountB})` };
    return { result: 0, reason: 'Rule 3d: Both mixed, same max & min, tie' };
  }

  // Mixed vs Pure
  if (pureA && !pureB) return { result: maxB <= maxA ? -1 : 1, reason: maxB <= maxA ? 'Rule 4: Mixed max <= pure, pure first' : 'Rule 4: Mixed max > pure, tie' };
  if (pureB && !pureA) return { result: maxA <= maxB ? 1 : -1, reason: maxA <= maxB ? 'Rule 4: Mixed max <= pure, pure first' : 'Rule 4: Mixed max > pure, tie' };

  return { result: 0, reason: 'Fallback tie' };
}


function compareSections(sectionA, sectionB) {
  // Extract rarity values from both sections
  const g = s => Array.from(s.querySelectorAll('.operator')).map(op => +op.dataset.rarity);
  const a = g(sectionA), b = g(sectionB);

  // Determine rarity range for both
  const maxA = Math.max(...a), maxB = Math.max(...b);
  const minA = Math.min(...a), minB = Math.min(...b);

  // Identify if section contains rarities 2 or 3
  const lowA = a.some(r => r === 2 || r === 3);
  const lowB = b.some(r => r === 2 || r === 3);

  // Identify if section is pure (only one rarity)
  const pureA = new Set(a).size === 1;
  const pureB = new Set(b).size === 1;

  // 🔹 Rule 1: Sections with rarities 2 or 3 lose to those without
  if (lowA && !lowB) return 1;
  if (lowB && !lowA) return -1;

  // 🔹 Rule 2: Both sections are pure (single rarity)
  if (pureA && pureB) {
    // Higher rarity first
    if (maxA !== maxB) return maxB - maxA;
    // Same rarity → fewer operators first
    return a.length - b.length;
  }

  // 🔹 Rule 3: Both sections are mixed (multiple rarities)
  if (!pureA && !pureB) {
    // Higher max rarity first
    if (maxA !== maxB) return maxB - maxA;
    // If same max, higher min rarity first
    if (minA !== minB) return minB - minA;
    // If same max & min, fewer lowest-rarity operators first
    const minCountA = a.filter(r => r === minA).length;
    const minCountB = b.filter(r => r === minB).length;
    if (minCountA !== minCountB) return minCountA - minCountB;
    return 0;
  }

  // 🔹 Rule 4: Mixed vs Pure comparison
  // Pure first if mixed max ≤ pure rarity
  if (pureA && !pureB) return maxB <= maxA ? -1 : 1;
  if (pureB && !pureA) return maxA <= maxB ? 1 : -1;

  // 🔹 Rule 5: Tie fallback
  return 0;
}

function createSection({ title, tagIds, allowRarity6 }) {
	let sectionElement = document.createElement("section");
	sectionElement.className = "operator-section";
	sectionElement.dataset.sectionKey = getSectionKey(Array.isArray(title) ? title : [title]);
	sectionElement.dataset.sectionOpen = "true";

	// Create header
	const header = createSectionHeader(title);
	sectionElement.appendChild(header);

	// Create content with operators
	const content = createSectionContent(tagIds, allowRarity6, header);
	if (!content) {
		console.warn(`No operators found for tags: ${tagIds}`);
		sectionElement = null;
		return sectionElement; // No operators to display
	};
	sectionElement.appendChild(content);

	// Set rarity attributes
	const operators = Array.from(content.children);
	const rarities = new Set(operators.map(op => op.dataset.rarity));
	sectionElement.dataset.rarityCommon = rarities.has("2") || rarities.has("3") ? "true" : "false";
	sectionElement.dataset.onlyRobot = rarities.size === 1 && rarities.has("1") ? "true" : "false";

	return sectionElement;
}

function createSectionHeader(title) {
	const header = document.createElement("div");
	header.className = "section-header";

	const sectionTags = document.createElement("div");
	sectionTags.className = "section-tags";

	const tagArray = Array.isArray(title) ? title : [title];
	tagArray.forEach(tag => {
		const tagElement = document.createElement("span");
		tagElement.className = "tag";
		tagElement.textContent = tag;
		sectionTags.appendChild(tagElement);
	});

	const sectionQuantity = document.createElement("div");
	sectionQuantity.className = "section-quantity";

	const quantitySpan = document.createElement("span");
	quantitySpan.className = "quantity";
	sectionQuantity.appendChild(quantitySpan);

	const svg = createChevronSvg();
	sectionQuantity.appendChild(svg);

	header.appendChild(sectionTags);
	header.appendChild(sectionQuantity);
	return header;
}

function updateSectionHeaderQuantity(header, quantity) {
	const quantitySpan = header.querySelector('.section-quantity span');
	quantitySpan.textContent = quantity;
}

function updateSectionHeader(header, title) {
	const tagsContainer = header.querySelector('.section-tags');
	tagsContainer.innerHTML = '';

	const tagArray = Array.isArray(title) ? title : [title];
	tagArray.forEach(tag => {
		const tagElement = document.createElement("span");
		tagElement.className = "tag";
		tagElement.textContent = tag;
		tagsContainer.appendChild(tagElement);
	});
}

function createChevronSvg() {
	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("xmlns", svgNS);
	svg.setAttribute("class", "icon");
	svg.setAttribute("width", "24");
	svg.setAttribute("height", "24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("viewBox", "0 0 24 24");

	const path = document.createElementNS(svgNS, "path");
	path.setAttribute("d", "m6 9 6 6 6-6");
	svg.appendChild(path);
	return svg;
}

function createSectionContent(tagIds, allowRarity6, header = null) {
	const content = document.createElement("ul");
	content.className = "section-content";

	// Filter operators based on tags and rarity
	const filteredOperators = Array.from(cachedOperators.values())
		.filter(op => {
			const hasAllTagIds = Array.isArray(tagIds)
				? tagIds.every(tagId =>
					op.rarity === tagId ||
					op.position === tagId ||
					op.profession === tagId ||
					op.tagList.includes(tagId)
				)
				: (
					op.rarity === tagIds ||
					op.position === tagIds ||
					op.profession === tagIds ||
					op.tagList.includes(tagIds)
				);
			return hasAllTagIds && (allowRarity6 || parseInt(op.rarity.split('_')[1], 10) < 6);
		})
		.sort((a, b) => parseInt(a.rarity.split('_')[1], 10) - parseInt(b.rarity.split('_')[1], 10) || a.appellation.localeCompare(b.appellation));

	if (filteredOperators.length === 0) return null; // No operators to display
	console.log(`Filtered Operators for Tags: ${tagIds}`, filteredOperators);
	filteredOperators.forEach(op => {
		content.appendChild(createOperatorElement(op));
	});

	// Update quantity in header
	const spanElement = header?.querySelector('.section-quantity span');
	console.log(`Updating quantity for Tags: ${tagIds}`, filteredOperators.length, spanElement);
	if (spanElement) {
		spanElement.textContent = filteredOperators.length;
	}

	return content;
}

function createOperatorElement(op) {
	const operatorElement = document.createElement("li");
	operatorElement.className = "operator";
	operatorElement.dataset.recruitment = op.recruitment
	operatorElement.dataset.rarity = parseInt(op.rarity.split('_')[1], 10);
	operatorElement.classList.add(op.profession.toLowerCase());
	operatorElement.classList.add(op.subProfessionId.toLowerCase());

	const operatorBox = document.createElement("div");
	operatorBox.className = "operator-box";

	// Create operator image
	const operatorImg = document.createElement("img");
	operatorImg.src = `https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets/refs/heads/cn/assets/torappu/dynamicassets/arts/charportraits/${op.id}_1.png`;
	operatorImg.alt = op.name_en || op.appellation;
	operatorBox.appendChild(operatorImg);

	// Create operator icons
	const operatorIcons = document.createElement("div");
	operatorIcons.className = "icon-tags";
	const classIcon = document.createElement("div");
	classIcon.className = "icon large profession-icon";
	const branchIcon = document.createElement("div");
	branchIcon.className = "icon profession-icon sub";
	operatorIcons.appendChild(classIcon);
	operatorIcons.appendChild(branchIcon);
	operatorBox.appendChild(operatorIcons);

	// Create operator name
	const operatorName = document.createElement("span");
	operatorName.className = "operator-name";
	operatorName.textContent = op.name_en || op.appellation;
	operatorBox.appendChild(operatorName);

	// Create background SVG
	const svg = createOperatorBackgroundSvg();

	operatorElement.appendChild(operatorBox);
	operatorElement.appendChild(svg);
	return operatorElement;
}

function createOperatorBackgroundSvg() {
	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("xmlns", svgNS);
	svg.setAttribute("class", "operator-svg");
	svg.setAttribute("width", "30");
	svg.setAttribute("height", "24");
	svg.setAttribute("fill", "black");
	svg.setAttribute("viewBox", "0 0 30 24");

	const path = document.createElementNS(svgNS, "path");
	path.setAttribute("d", "M 0 16.832 L 0 0.954 L 30 15.078 L 30 24 L 15.176 24 L 0 16.832 Z");
	svg.appendChild(path);
	return svg;
}

if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
	console.log("Page was reloaded.");
} else {
	console.log("Page was loaded normally.");
}


function initializeCheckbox(checkboxId, onChangeCallback = null) {
	const label = document.querySelector(`label[for="${checkboxId}"]`);
	const checkbox = document.getElementById(checkboxId);

	if (!label || !checkbox) {
		console.warn(`Checkbox with id "${checkboxId}" or its label not found`);
		return;
	}

	const [uncheckedIcon, checkedIcon] = label.querySelectorAll('.icon > svg');

	function updateCheckboxState() {
		label.setAttribute('aria-checked', checkbox.checked);
		uncheckedIcon.classList.toggle('hidden', checkbox.checked);
		checkedIcon.classList.toggle('hidden', !checkbox.checked);
	}

	checkbox.checked = localStorage.getItem(checkboxId) === 'true';
	updateCheckboxState();
	if (onChangeCallback) onChangeCallback(checkbox.checked);

	checkbox.addEventListener('change', (e) => {
		localStorage.setItem(checkboxId, e.target.checked);
		if (onChangeCallback) onChangeCallback(e.target.checked);
	});

	label.addEventListener('click', (e) => {
		e.preventDefault();
		checkbox.checked = !checkbox.checked;
		updateCheckboxState();
		checkbox.dispatchEvent(new Event('change'));
	});

	label.addEventListener('keydown', (e) => {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			label.click();
		}
	});
}

function initializeRadioGroup(radioGroupId, defaultValue = null, onChangeCallback = null) {
	const radioGroup = document.querySelector(`.toggle-group[aria-labelledby="${radioGroupId}"]`);

	function updateRadioGroupState() {
		radioGroup.querySelectorAll('.btn-radio').forEach(label => {
			const input = label.querySelector('input[type="radio"]');
			const isChecked = input.checked;

			// Update visual highlight
			label.classList.toggle('active', isChecked);

			// Update ARIA state
			label.setAttribute('aria-checked', isChecked);

		});
	}
	let selectedInput = radioGroup.querySelector(`input[value="${localStorage.getItem(radioGroupId)}"]`);
	if (selectedInput) selectedInput.checked = true;
	if (!selectedInput && defaultValue) {
		selectedInput = radioGroup.querySelector(`input[value="${defaultValue}"]`);
		selectedInput.checked = true;
		localStorage.setItem(radioGroupId, defaultValue);
	}
	


	// Initialize active styles on page load
	updateRadioGroupState();
	// Call callback if provided
	if (onChangeCallback) onChangeCallback(selectedInput.value);


	// Listen for changes on the radio inputs
	radioGroup.addEventListener('change', (e) => {
		if (e.target.matches('input[type="radio"]')) {
			localStorage.setItem(radioGroupId, e.target.value);
			updateRadioGroupState();
			// Call callback if provided
			if (onChangeCallback) onChangeCallback(e.target.value);
			console.log(`For ${radioGroupId} the selected option: `, e.target.value);
		}
	});
	console.log("Initialized radio group:", radioGroupId);
}

export function testAPI() {
	const filters = {
		all: {

		},
		any: {
			profession: ["先锋干员"], // character must have at least one of these tags

		}
	};
	console.log("Testing API with filters:", filters);
	const result = filterOperators(characterData, filters, false);
	console.log("Matched:", result.length);
	console.table(result.map(c => ({
		name: c.name,
		rarity: c.rarity,
		profession: c.profession,
		position: c.position,
		tags: c.tagList,
		powers: c.powers
	})));
}

window.testAPI = testAPI; // Expose for testing

// Call the function when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
	loadTag();
	initializeCheckbox('toggle-rarity-common', (value) => {
		const recruitmentList = document.getElementById("recruitment-list");
		recruitmentList.dataset.hideCommon = value;
	});
	initializeCheckbox('toggle-rarity-robot', (value) => {
		const recruitmentList = document.getElementById("recruitment-list")
		recruitmentList.dataset.hideRobot = value
	});
	initializeRadioGroup('view-mode-select', 'portrait', (value) => {
		const recruitmentList = document.getElementById("recruitment-list");
		recruitmentList.dataset.viewMode = value;
	});
	initializeRadioGroup('server-select', 'Global', (value) => {
		const recruitmentList = document.getElementById("recruitment-list")
		recruitmentList.dataset.server = value;
	});

});

