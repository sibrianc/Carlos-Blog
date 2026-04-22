/* ==========================================================================
   CIPITIO SYSTEM
   ========================================================================== */

export class CipitioSystem {
    constructor(options = {}) {
        this.controller = new AbortController();
        this.signal = options.signal || this.controller.signal;
        this.cipitio = document.getElementById("cipitio-entity");
        this.rock = document.getElementById("cipitio-rock");
        this.panel = document.getElementById("contact-panel");
        this.form = this.panel ? this.panel.querySelector("form") : null;
        this.inputs = document.querySelectorAll(".cyber-input");

        this.modal = document.getElementById("cyber-modal");
        this.modalMsg = document.getElementById("modal-message");
        this.closeBtn = document.getElementById("close-modal");

        this.msgNameRequired = this.panel?.dataset.msgNameRequired || "Name is required.";
        this.msgEmailRequired = this.panel?.dataset.msgEmailRequired || "Email is required.";
        this.msgEmailInvalid = this.panel?.dataset.msgEmailInvalid || "Invalid email format.";
        this.msgMessageRequired = this.panel?.dataset.msgMessageRequired || "Message is required.";

        this.isActive = false;
        this.currentSide = "left";

        if (this.cipitio && this.panel && this.form && this.inputs.length > 0) {
            this.init();
        }
    }

    init() {
        this.positionRandomly();

        this.form.addEventListener("submit", (e) => this.validateAndAct(e), { signal: this.signal });

        if (this.closeBtn) {
            this.closeBtn.addEventListener("click", () => this.hideModal(), { signal: this.signal });
        }

        if (this.modal) {
            this.modal.addEventListener("click", (e) => {
                if (e.target === this.modal) this.hideModal();
            }, { signal: this.signal });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this.hideModal();
        }, { signal: this.signal });

        this.cipitio.addEventListener("click", () => this.positionRandomly(), { signal: this.signal });
    }

    destroy() {
        this.controller.abort();
    }

    positionRandomly() {
        if (this.isActive) return;

        this.currentSide = Math.random() > 0.5 ? "left" : "right";
        this.cipitio.style.transition = "left 1s ease-in-out";
        if (this.currentSide === "left") {
            this.cipitio.style.left = `${Math.random() * 25 + 5}%`;
        } else {
            this.cipitio.style.left = `${Math.random() * 25 + 65}%`;
        }
    }

    validateAndAct(e) {
        let errorFound = false;
        let errorMsg = "";
        let targetInput = null;

        const botField = document.querySelector('input[name="bot_catcher"]');
        if (botField && botField.value !== "") {
            e.preventDefault();
            return;
        }

        const nameInput = this.form.querySelector('input[name="name"]');
        const emailInput = this.form.querySelector('input[name="email"]');
        const msgInput = this.form.querySelector('textarea[name="message"]');

        if (!nameInput.value.trim()) {
            errorFound = true;
            errorMsg = this.msgNameRequired;
            targetInput = nameInput;
        } else if (!emailInput.value.trim()) {
            errorFound = true;
            errorMsg = this.msgEmailRequired;
            targetInput = emailInput;
        } else if (!this.isValidEmail(emailInput.value)) {
            errorFound = true;
            errorMsg = this.msgEmailInvalid;
            targetInput = emailInput;
        } else if (!msgInput.value.trim()) {
            errorFound = true;
            errorMsg = this.msgMessageRequired;
            targetInput = msgInput;
        }

        if (errorFound) {
            e.preventDefault();
            this.showModal(errorMsg);
            if (!this.isActive && targetInput) this.attack(targetInput);
            return;
        }

        const submitBtn = this.form.querySelector("#submitBtn");
        const btnText = this.form.querySelector("#btnText");
        if (submitBtn) submitBtn.disabled = true;
        if (btnText) {
            const sendingText = submitBtn?.dataset.sending || "Sending...";
            btnText.innerText = sendingText;
        }
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showModal(msg) {
        if (this.modal && this.modalMsg) {
            this.modalMsg.textContent = msg;
            this.modal.classList.add("active");
        }
    }

    hideModal() {
        if (this.modal) this.modal.classList.remove("active");
    }

    attack(targetInput) {
        this.isActive = true;

        const panelRect = this.panel.getBoundingClientRect();
        const cipitioRect = this.cipitio.getBoundingClientRect();
        const inputRect = targetInput.getBoundingClientRect();

        const startX = cipitioRect.left - panelRect.left + (cipitioRect.width / 2);
        const startY = cipitioRect.top - panelRect.top + (cipitioRect.height / 2);
        const endX = inputRect.left - panelRect.left + (inputRect.width / 2);
        const endY = inputRect.top - panelRect.top + (inputRect.height / 2);

        this.rock.style.transition = "none";
        this.rock.style.transform = `translate(${startX}px, ${startY}px)`;
        this.rock.style.opacity = "0";

        if (this.currentSide === "left") {
            this.cipitio.classList.add("is-throwing-right");
        } else {
            this.cipitio.classList.add("is-throwing-left");
        }

        setTimeout(() => {
            this.rock.style.transition = "transform 0.4s cubic-bezier(0.2, 0.6, 0.3, 1), opacity 0.1s";
            this.rock.style.opacity = "1";
            this.rock.style.transform = `translate(${endX}px, ${endY}px) rotate(720deg)`;
        }, 220);

        setTimeout(() => {
            this.rock.style.opacity = "0";
            this.triggerGlitch(targetInput);
            this.returnToWatch();
        }, 650);
    }

    triggerGlitch(input) {
        input.classList.add("input-glitch");
        setTimeout(() => input.classList.remove("input-glitch"), 500);
    }

    returnToWatch() {
        this.cipitio.classList.remove("is-throwing-right");
        this.cipitio.classList.remove("is-throwing-left");
        void this.cipitio.offsetWidth;
        this.isActive = false;
    }
}
