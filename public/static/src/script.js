import { fetchAllTags, fetchRecruitableOperators, fetchRecruitmentData } from "./api.js";
import { saveToDB, getFromDB, isLocalDataOutdated } from "./db.js";
import { filterOperators } from "./recruitment.js";
import { toastNotification } from "./toast.js";
import characterData from "../arknights/characters_en.json" with { type: "json" };
import recruitmentData from "../arknights/recruitment.json" with { type: "json" };

let STORAGE_KEY_COMMON = 'hideRarityCommonSections';
let STORAGE_KEY_ROBOT = 'hideOnlyRarityRobotSections';

const maxTags = 5;
let hideRarityCommonSections = localStorage.getItem(STORAGE_KEY_COMMON) === 'true';
let hideOnlyRarityRobotSections = localStorage.getItem(STORAGE_KEY_ROBOT) === 'true';
let selectedTags = { // Store selected tags by category
	"rarity": new Set(), 
	"position": new Set(), 
	"profession": new Set(), 
	"tagList": new Set()
}; 
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

window.addEventListener("beforeinstallprompt", event => {
	event.preventDefault();
	deferredPrompt = event;

	/* document.getElementById("installPWA").style.display = "block"; */ // Show install button
});

/* document.getElementById("installPWA").addEventListener("click", () => {
	if (deferredPrompt) {
		deferredPrompt.prompt();
		deferredPrompt.userChoice.then(choiceResult => {
			if (choiceResult.outcome === "accepted") {
				console.log("✅ User installed PWA!");

				// Register service worker after installation
				navigator.serviceWorker.register("sw.js").then(reg => {
					console.log("✅ Service Worker registered!", reg.scope);
				});
			} else {
				console.log("❌ User dismissed PWA install.");
			}
			deferredPrompt = null;
		});
	}
}); */

// Check if PWA is installed
window.addEventListener("appinstalled", () => {
	isPWAInstalled = true;
});

async function fetchAllOperators() {
	const operators = await fetchRecruitableOperators();
	saveToDB("operators", operators);
}

async function loadTags(forceUpdate = false) {
	let tags = await getFromDB("tags");

	if (!tags.length || forceUpdate) {
		tags = await fetchAllTags();
		saveToDB("tags", tags);
	}

	populateTags(tags);
}

async function loadTag() {
	let tags = recruitmentData.tags.data || [];
	populateTags(tags);
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
	sortedSections.sort((a, b) => compareSections(a, b));
	sortedSections.forEach(section => containerElement.appendChild(section));

	// Apply initial visibility state
	updateVisibility();
}

function compareSections(sectionA, sectionB) {
	const operatorsA = Array.from(sectionA.querySelectorAll('.operator'));
	const operatorsB = Array.from(sectionB.querySelectorAll('.operator'));

	const raritiesA = [...new Set(operatorsA.map(op => parseInt(op.dataset.rarity)))].sort((x, y) => y - x);
	const raritiesB = [...new Set(operatorsB.map(op => parseInt(op.dataset.rarity)))].sort((x, y) => y - x);

	if (raritiesA.length === 1 && raritiesB.length > 1) return -1;
	if (raritiesB.length === 1 && raritiesA.length > 1) return 1;
	if (raritiesA.length === 1 && raritiesB.length === 1) {
		if (raritiesA[0] !== raritiesB[0]) return raritiesB[0] - raritiesA[0];
	}

	return operatorsA.length - operatorsB.length;
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
	sectionElement.dataset.RarityCommon = rarities.has("2") || rarities.has("3") ? "true" : "false";
	sectionElement.dataset.OnlyRarityRobot = rarities.size === 1 && rarities.has("1") ? "true" : "false";

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

// Function to toggle section visibility based on current toggles
function updateVisibility() {
	document.querySelectorAll("#recruitment-list section").forEach(section => {
		if (hideRarityCommonSections && section.dataset.RarityCommon === "true") {
			section.style.display = "none";
		} else if (hideOnlyRarityRobotSections && section.dataset.OnlyRarityRobot === "true") {
			section.style.display = "none";
		} else {
			section.style.display = "";
		}
	});
}

function handleResponsiveElement() {
	const remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize); // Convert rem to px
	const breakpoint = 48 * remToPx; // Example: 48rem to px
	let screenWidth = window.innerWidth;
	let existingElement = document.querySelector(".banner-background");

	if (screenWidth >= breakpoint) {
		// Add the element only if it doesn't exist
		if (!existingElement) {
			let newElement = document.createElement("div");
			newElement.classList.add("banner-background");
			const banner = document.querySelector(".layout-container");
			banner.insertBefore(newElement, banner.firstChild);
		}
	} else {
		// Remove the element if it exists
		if (existingElement) {
			existingElement.remove();
		}
	}
}

// Run on page load
handleResponsiveElement();

// Run on window resize
window.addEventListener("resize", handleResponsiveElement);



// Attach event listeners for UI toggles
document.getElementById("toggle-rarity-common").addEventListener("change", function () {
	hideRarityCommonSections = this.checked;
	localStorage.setItem(STORAGE_KEY_COMMON, hideRarityCommonSections);
	updateVisibility();
});

document.getElementById("toggle-rarity-robot").addEventListener("change", function () {
	hideOnlyRarityRobotSections = this.checked;
	localStorage.setItem(STORAGE_KEY_ROBOT, hideOnlyRarityRobotSections);
	updateVisibility();
});

if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
	console.log("Page was reloaded.");
} else {
	console.log("Page was loaded normally.");
}


function initializeCheckbox(checkboxId) {
	const label = document.querySelector(`label[for="${checkboxId}"]`);
	const checkbox = document.getElementById(checkboxId);

	if (!label || !checkbox) {
		console.warn(`Checkbox with id "${checkboxId}" or its label not found`);
		return;
	}

	// Restore saved state
	if (checkboxId === 'toggle-rarity-common') {
		checkbox.checked = hideRarityCommonSections;
	} else if (checkboxId === 'toggle-rarity-robot') {
		checkbox.checked = hideOnlyRarityRobotSections;
	}

	const [uncheckedIcon, checkedIcon] = label.querySelectorAll('.icon > svg');

	function updateCheckboxState() {
		label.setAttribute('aria-checked', checkbox.checked);
		uncheckedIcon.classList.toggle('hidden', checkbox.checked);
		checkedIcon.classList.toggle('hidden', !checkbox.checked);
	}

	// Update visual state without triggering change event
	updateCheckboxState();

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
	initializeCheckbox('toggle-rarity-common');
	initializeCheckbox('toggle-rarity-robot');
	
});

