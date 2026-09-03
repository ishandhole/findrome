/**
 * Findrome Recruitment Form - Client Logic
 * Handles validation, preference synchronization, and form submission.
 */

// 1. Theme Toggle
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const newTheme = isDark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });
}

// 2. Form Elements
const form = document.getElementById("findromeForm");
const phone = document.getElementById("phone");
const sapId = document.getElementById("sapId");
const email = document.getElementById("email");
const sop = document.getElementById("sop");
const submitButton = form ? form.querySelector("button[type='submit']") : null;

const successModal = document.getElementById("successModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const successId = document.getElementById("successId");
const successMessage = document.getElementById("successMessage");

const preferences = [
    document.getElementById("firstPreference"),
    document.getElementById("secondPreference"),
    document.getElementById("thirdPreference")
].filter(Boolean);

// 3. Error Handling Helpers
function showError(element, message) {
    let error = element.parentElement.querySelector(".field-error");
    if (!error) {
        error = document.createElement("span");
        error.className = "field-error";
        element.parentElement.appendChild(error);
    }
    error.textContent = message;
    element.classList.add("input-error");
}

function clearError(element) {
    const error = element.parentElement.querySelector(".field-error");
    if (error) error.textContent = "";
    element.classList.remove("input-error");
}

// 4. Live Input Formatting & Validation
if (phone) {
    phone.addEventListener("input", () => {
        phone.value = phone.value.replace(/\D/g, "").slice(0, 10);
        if (phone.value.length === 10) clearError(phone);
    });
}

if (sapId) {
    sapId.addEventListener("input", () => {
        sapId.value = sapId.value.replace(/\D/g, "").slice(0, 11);
        if (sapId.value.length === 11) clearError(sapId);
    });
}

if (email) {
    email.addEventListener("input", () => {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) clearError(email);
    });
}

// Prevent selecting duplicate department preferences
function syncPreferences() {
    const selected = preferences.map(s => s.value);
    preferences.forEach(select => {
        Array.from(select.options).forEach(opt => {
            if (!opt.value) return;
            opt.disabled = selected.includes(opt.value) && opt.value !== select.value;
        });
    });
}

preferences.forEach(select => {
    select.addEventListener("change", () => {
        clearError(select);
        syncPreferences();
    });
});

if (sop) {
    sop.addEventListener("change", () => {
        clearError(sop);
        if (sop.files.length && !sop.files[0].name.toLowerCase().endsWith(".pdf")) {
            showError(sop, "Please upload your SOP in PDF format only.");
            sop.value = "";
        }
    });
}

// 5. Form Validation
function validateForm() {
    let isValid = true;

    // Check required inputs
    form.querySelectorAll("[required]").forEach(field => {
        clearError(field);
        if (field.type === "radio") return;
        if (!field.value.trim()) {
            showError(field, "This field is required.");
            isValid = false;
        }
    });

    // Check radio group
    const radioChecked = form.querySelector('input[name="previousFindrome"]:checked');
    const radioBox = form.querySelector(".radio-group");
    const radioErr = radioBox.querySelector(".field-error");
    if (!radioChecked) {
        if (!radioErr) {
            const err = document.createElement("span");
            err.className = "field-error";
            err.textContent = "Please select an option.";
            radioBox.appendChild(err);
        }
        isValid = false;
    } else if (radioErr) {
        radioErr.remove();
    }

    // Validate email, phone, sapId
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        showError(email, "Please enter a valid email address.");
        isValid = false;
    }
    if (!/^\d{10}$/.test(phone.value)) {
        showError(phone, "Phone number must be exactly 10 digits.");
        isValid = false;
    }
    if (!/^\d{11}$/.test(sapId.value)) {
        showError(sapId, "SAP ID must be exactly 11 digits.");
        isValid = false;
    }

    // Validate 3 distinct preferences
    const prefValues = preferences.map(s => s.value);
    if (prefValues.includes("") || new Set(prefValues).size !== prefValues.length) {
        showError(preferences[preferences.length - 1], "Please select 3 different department preferences.");
        isValid = false;
    }

    return isValid;
}

// 6. Form Submission
if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
        if (successModal) successModal.classList.add("hidden");
    });
}

if (form) {
    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!validateForm()) {
            const firstError = form.querySelector(".input-error");
            if (firstError) {
                firstError.scrollIntoView({ behavior: "smooth", block: "center" });
                firstError.focus();
            }
            return;
        }

        const formData = new FormData(form);
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = "Submitting Application...";

        try {
            const response = await fetch("/api/submit", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Show Success Confirmation Modal
                if (successId) successId.textContent = `#${result.submissionId}`;
                if (successMessage) successMessage.textContent = result.message;
                if (successModal) successModal.classList.remove("hidden");

                // Reset form
                form.reset();
                preferences.forEach(s => Array.from(s.options).forEach(o => o.disabled = false));
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                alert(result.message || "Failed to submit. Please try again.");
            }
        } catch (error) {
            alert("Could not connect to the server. Please check your internet connection and try again.");
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
        }
    });
}