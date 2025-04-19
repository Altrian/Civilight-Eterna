// Define the function to adjust text size
function adjustTextSize(element, options) {
    const t = ["1.5rem", "1.3125rem", "1rem", "0.875rem"];
    const u = ["4.5rem", "4rem", "3.5rem", "3rem", "2.5rem", "2rem", "1.75rem", ...t];
    const requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || (c => setTimeout(c, 1000 / 60));
    
    let lock = false;
    let size = 0;
    let lastSize = -1;

    const resizeText = async () => {
        if (lock) return;

        const c = element;
        if (!(c != null && c.parentElement)) return;

        const f = c.parentElement.getBoundingClientRect();

        let p = 0;
        if (options.extraText) {
            const tempDiv = document.createElement("div");
            tempDiv.className = options.extraTextClass || "";
            tempDiv.style.width = f.width + "px";
            tempDiv.innerText = options.extraText;
            tempDiv.style.position = "fixed";
            tempDiv.style.visibility = "hidden";
            document.body.appendChild(tempDiv);
            p = tempDiv.getBoundingClientRect().height;
            tempDiv.remove();
        }

        let m = 0;
        const v = c.parentElement.children;
        let E;
        for (let i = 0; E = v[i], i < v.length; i++) {
            E !== c && (!E.textContent && getComputedStyle(E).flexGrow === "1" || (m += E.getBoundingClientRect().height));
            

        }

        const targetHeight = (options.targetHeight ?? f.height) - p - m;
        

        if (f.width * targetHeight <= lastSize && (lastSize = f.width * targetHeight, c.scrollHeight <= targetHeight && c.scrollWidth <= f.width)) {
            
            return;
        }
        

        lock = true;
        lastSize = f.width * targetHeight;

        const h = "__bigtext_target";
        c.classList.add(h);
        const b = cloneWithStyles(c.parentElement);
        c.classList.remove(h);
        b.style.position = "fixed";
        b.style.visibility = "hidden";
        b.style.left = -(f.width * 2) + "px";
        b.style.top = -(targetHeight * 2) + "px";
        b.style.width = f.width + "px";
        b.style.height = targetHeight + "px";
        

        const y = b.querySelector(`.${h}`);
        y.style.width = "auto";
        document.body.appendChild(b);

        const fontSizes = options.small ? t : u;
        for (size = 0; size < fontSizes.length - 1 && (y.style.fontSize = fontSizes[size], 
            !(y.scrollHeight <= Math.ceil(targetHeight) && y.scrollWidth <= Math.ceil(f.width))); ) {
            size++;
            
            
            
        }
        c.style.fontSize = fontSizes[size];
        

        const w = y.scrollHeight;
        let O = y.scrollWidth;
        
        const R = window.innerWidth / 15;
  
        for (; O > 0 && (y.style.width = O - R + "px", y.scrollHeight === w); ) {
            
            O -= R;
        }
        
        c.style.width = (O + 1) + "px";
        b.remove();
        lock = false;
    };

    const debouncedResizeText = debounce(resizeText, 1000 / 15);

    const resizeObserver = new ResizeObserver(debouncedResizeText);
    resizeObserver.observe(element.parentElement);

    window.addEventListener('resize', resizeText);

    // Initial call to resize text
    requestAnimationFrame(resizeText);
}

// Utility function to clone an element with styles
function cloneWithStyles(originalElement) {
    // Clone the original element deeply (including children)
    const clonedElement = originalElement.cloneNode(true);
  
    // Function to copy computed styles from the original to the clone
    function copyStyles(srcElement, destElement) {
      // Get the computed styles of the source element
      const computedStyles = window.getComputedStyle(srcElement);
  
      // Loop over each style and copy it to the destination element
      for (let style of computedStyles) {
        destElement.style[style] = computedStyles.getPropertyValue(style);
      }
    }
  
    // Copy styles from the original element to the cloned one
    copyStyles(originalElement, clonedElement);
  
    // Recursively copy styles to all children
    function copyChildrenStyles(srcElement, destElement) {
      const children = srcElement.children;
      const clonedChildren = destElement.children;
  
      for (let i = 0; i < children.length; i++) {
        copyStyles(children[i], clonedChildren[i]);
        copyChildrenStyles(children[i], clonedChildren[i]);  // Recursively copy child styles
      }
    }
  
    // Apply styles to the children
    copyChildrenStyles(originalElement, clonedElement);
  
    return clonedElement;
}

// Utility function to debounce another function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Usage example
const element = document.querySelector('.title p');
const options = {
    small: false,
    targetHeight: null,
    extraText: null,
    extraTextClass: null,
};
adjustTextSize(element, options);