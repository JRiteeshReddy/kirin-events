/**
 * Kirin Events — Luma-Style Volunteer Platform Client
 * Core SPA Logic, Routing, Contentful CDN API Integration, Date Parsers
 */

class KirinEventsApp {
    constructor() {
        this.events = [];
        this.filteredEvents = [];
        this.currentFilter = 'all';
        this.activeEvent = null;

        // Hardcoded Contentful CDN credentials
        this.CONTENTFUL_SPACE_ID = '46mef9e7vxq9';
        this.CONTENTFUL_CDN_TOKEN = 'IwmWLIq0FDFmxQW6F5w_hV2NED-YYZmQO_r8xmShi7g';
        this.CONTENTFUL_CONTENT_TYPE = 'kirinevents';

        // Auth related states
        this.user = null;
        this.userProfile = null;
        this.authMode = 'login'; // 'login' or 'signup'
        this.pendingRegistration = false;
    }

    /**
     * Initial startup handler
     */
    init() {
        console.log("Kirin Events SPA Initializing...");
        
        // Set up Event Listeners
        this.bindEvents();
        
        // SPA Hash routing listener
        window.addEventListener('hashchange', () => this.handleRouting());

        // Initial Data Fetch from Contentful
        this.fetchEvents().then(() => {
            this.handleRouting();
        });

        // Initialize Firebase Auth connection listener
        setTimeout(() => {
            if (window.firebaseInstance && window.firebaseInstance.isInitialized) {
                console.log("Firebase Auth bridge initialized.");
                window.firebaseInstance.onAuthChanged(async (user) => {
                    await this.handleAuthStateChange(user);
                });
            } else {
                console.warn("Firebase Instance is not initialized yet.");
            }
        }, 200);
    }

    /**
     * Bind DOM interaction listeners
     */
    bindEvents() {
        // Close modals on backdrop clicks
        const signupModal = document.getElementById('signup-modal');
        signupModal.addEventListener('click', (e) => {
            if (e.target === signupModal) this.closeSignupModal();
        });

        const authModal = document.getElementById('auth-modal');
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) this.closeAuthModal();
        });

        const accountModal = document.getElementById('account-modal');
        accountModal.addEventListener('click', (e) => {
            if (e.target === accountModal) this.closeAccountModal();
        });

        // Close dropdown when clicking outside user menu
        window.addEventListener('click', (e) => {
            const userMenu = document.getElementById('nav-user-menu');
            const dropdown = document.getElementById('nav-dropdown-menu');
            if (userMenu && !userMenu.contains(e.target)) {
                userMenu.classList.remove('open');
                if (dropdown) dropdown.classList.add('hidden');
            }
        });
    }

    /* ==========================================================================
       AUTHENTICATION & VOLUNTEER PROFILE ACTIONS
       ========================================================================== */

    async handleAuthStateChange(user) {
        console.log("Auth State Changed. User:", user ? user.email : "Logged Out");
        
        const navLoginBtn = document.getElementById('nav-login-btn');
        const navUserMenu = document.getElementById('nav-user-menu');
        const initialsSpan = document.getElementById('nav-user-initials');
        const dropdownEmail = document.getElementById('dropdown-user-email');

        if (user) {
            this.user = user;
            
            // Try fetching Firestore Profile
            if (window.firebaseInstance && window.firebaseInstance.isInitialized) {
                const profile = await window.firebaseInstance.getProfile(user.uid);
                if (profile) {
                    this.userProfile = profile;
                    console.log("Firestore profile loaded successfully.");
                } else {
                    // Try LocalStorage backup
                    const localProfile = localStorage.getItem(`kirin_profile_${user.uid}`);
                    if (localProfile) {
                        this.userProfile = JSON.parse(localProfile);
                        console.log("LocalStorage backup profile loaded.");
                    } else {
                        this.userProfile = null;
                    }
                }
            }

            // Update UI elements
            if (navLoginBtn) navLoginBtn.classList.add('hidden');
            if (navUserMenu) navUserMenu.classList.remove('hidden');
            
            const avatarImg = document.getElementById('nav-user-avatar');
            const nameSpan = document.getElementById('nav-user-name');
            
            // Set User Name & Avatar & Initials
            const name = this.userProfile?.name || user.displayName || user.email || 'User';
            const shortName = this.userProfile?.name || user.displayName || 'Volunteer';
            
            if (nameSpan) {
                nameSpan.textContent = shortName;
            }
            
            if (user.photoURL) {
                if (avatarImg) {
                    avatarImg.src = user.photoURL;
                    avatarImg.classList.remove('hidden');
                }
                if (initialsSpan) initialsSpan.classList.add('hidden');
            } else {
                if (avatarImg) avatarImg.classList.add('hidden');
                if (initialsSpan) {
                    initialsSpan.textContent = this.getUserInitials(name);
                    initialsSpan.classList.remove('hidden');
                }
            }
            
            if (dropdownEmail) dropdownEmail.textContent = user.email;

            // Close Auth Modal
            this.closeAuthModal();

            // Resume any event registration that was waiting for login
            if (this.pendingRegistration) {
                this.pendingRegistration = false;
                setTimeout(() => this.openSignupModal(), 100);
            }
        } else {
            this.user = null;
            this.userProfile = null;
            
            if (navLoginBtn) navLoginBtn.classList.remove('hidden');
            if (navUserMenu) navUserMenu.classList.add('hidden');
        }
    }

    getUserInitials(name) {
        if (!name) return 'UN';
        const parts = name.split(' ').filter(p => p.trim().length > 0);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }

    // Modal Control wrappers
    openAuthModal() {
        this.authMode = 'login';
        this.updateAuthModalUI();
        const errEl = document.getElementById('auth-error-msg');
        if (errEl) errEl.classList.add('hidden');
        document.getElementById('auth-modal').classList.remove('hidden');
    }

    closeAuthModal() {
        document.getElementById('auth-modal').classList.add('hidden');
    }

    openAccountModal() {
        // Toggle user dropdown close
        document.getElementById('nav-user-menu').classList.remove('open');
        document.getElementById('nav-dropdown-menu').classList.add('hidden');

        // Pre-populate Profile Form values
        if (this.userProfile) {
            document.getElementById('profile-name').value = this.userProfile.name || '';
            document.getElementById('profile-whatsapp').value = this.userProfile.whatsapp || '';
            document.getElementById('profile-age').value = this.userProfile.age || '';
            document.getElementById('profile-location').value = this.userProfile.location || '';
            document.getElementById('profile-experience').value = this.userProfile.experience || '';
        } else if (this.user) {
            document.getElementById('profile-name').value = this.user.displayName || '';
            document.getElementById('profile-whatsapp').value = '';
            document.getElementById('profile-age').value = '';
            document.getElementById('profile-location').value = '';
            document.getElementById('profile-experience').value = '';
        }

        const msgEl = document.getElementById('profile-status-msg');
        if (msgEl) msgEl.classList.add('hidden');

        document.getElementById('account-modal').classList.remove('hidden');
    }

    closeAccountModal() {
        document.getElementById('account-modal').classList.add('hidden');
    }

    toggleUserDropdown() {
        const menu = document.getElementById('nav-user-menu');
        const dropdown = document.getElementById('nav-dropdown-menu');
        if (menu && dropdown) {
            menu.classList.toggle('open');
            dropdown.classList.toggle('hidden');
        }
    }

    // Google Sign-In handler
    async handleGoogleSignIn() {
        const spinner = document.getElementById('auth-btn-spinner');
        const errEl = document.getElementById('auth-error-msg');
        
        if (errEl) errEl.classList.add('hidden');
        if (spinner) spinner.classList.remove('hidden');

        try {
            if (window.firebaseInstance && window.firebaseInstance.isInitialized) {
                await window.firebaseInstance.signInWithGoogle();
                console.log("Google authentication completed.");
            } else {
                throw new Error("Authentication module is temporarily unavailable.");
            }
        } catch (e) {
            console.error("Google auth failed:", e);
            if (errEl) {
                errEl.textContent = e.message || "Failed to log in with Google.";
                errEl.classList.remove('hidden');
            }
        } finally {
            if (spinner) spinner.classList.add('hidden');
        }
    }

    // Auth Mode Toggler (Login vs Signup)
    toggleAuthMode(e) {
        if (e) e.preventDefault();
        this.authMode = this.authMode === 'login' ? 'signup' : 'login';
        this.updateAuthModalUI();
    }

    updateAuthModalUI() {
        const title = document.querySelector('#auth-modal h2');
        const btnText = document.getElementById('auth-btn-text');
        const toggleText = document.getElementById('auth-toggle-text');
        
        if (this.authMode === 'login') {
            if (title) title.textContent = "Volunteer Sign In";
            if (btnText) btnText.textContent = "Sign In";
            if (toggleText) toggleText.innerHTML = `Don't have an account? <a href="#" onclick="app.toggleAuthMode(event)">Sign Up</a>`;
        } else {
            if (title) title.textContent = "Create Volunteer Account";
            if (btnText) btnText.textContent = "Create Account";
            if (toggleText) toggleText.innerHTML = `Already have an account? <a href="#" onclick="app.toggleAuthMode(event)">Sign In</a>`;
        }
    }

    // Email & Password Auth Handler
    async handleEmailAuth(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const spinner = document.getElementById('auth-btn-spinner');
        const errEl = document.getElementById('auth-error-msg');
        const submitBtn = document.getElementById('auth-submit-btn');

        if (errEl) errEl.classList.add('hidden');
        if (spinner) spinner.classList.remove('hidden');
        if (submitBtn) submitBtn.disabled = true;

        try {
            if (window.firebaseInstance && window.firebaseInstance.isInitialized) {
                if (this.authMode === 'login') {
                    await window.firebaseInstance.signInWithEmail(email, password);
                    console.log("Email sign in successful.");
                } else {
                    await window.firebaseInstance.signUpWithEmail(email, password);
                    console.log("Email registration successful.");
                }
            } else {
                throw new Error("Authentication module is temporarily offline.");
            }
        } catch (err) {
            console.error("Email auth failed:", err);
            let userFriendlyMsg = err.message;
            // Beautify common Firebase errors
            if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                userFriendlyMsg = "Invalid email or password combination.";
            } else if (err.code === 'auth/email-already-in-use') {
                userFriendlyMsg = "An account with this email address already exists.";
            } else if (err.code === 'auth/weak-password') {
                userFriendlyMsg = "Password must be at least 6 characters long.";
            } else if (err.code === 'auth/invalid-email') {
                userFriendlyMsg = "Please enter a valid email address.";
            }
            if (errEl) {
                errEl.textContent = userFriendlyMsg;
                errEl.classList.remove('hidden');
            }
        } finally {
            if (spinner) spinner.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    // Profile Settings Save
    async handleProfileSave(e) {
        e.preventDefault();
        if (!this.user) return;

        const name = document.getElementById('profile-name').value.trim();
        const whatsapp = document.getElementById('profile-whatsapp').value.trim();
        const age = document.getElementById('profile-age').value;
        const location = document.getElementById('profile-location').value.trim();
        const experience = document.getElementById('profile-experience').value.trim();
        
        const spinner = document.getElementById('profile-btn-spinner');
        const saveBtn = document.getElementById('profile-save-btn');
        const statusMsg = document.getElementById('profile-status-msg');

        if (spinner) spinner.classList.remove('hidden');
        if (saveBtn) saveBtn.disabled = true;
        if (statusMsg) statusMsg.classList.add('hidden');

        const profileData = { name, whatsapp, age, location, experience };

        try {
            // Save to LocalStorage
            localStorage.setItem(`kirin_profile_${this.user.uid}`, JSON.stringify(profileData));
            this.userProfile = profileData;

            // Save to Firebase Firestore
            if (window.firebaseInstance && window.firebaseInstance.isInitialized) {
                await window.firebaseInstance.saveProfile(this.user.uid, profileData);
            }

            // Success feedback
            if (statusMsg) {
                statusMsg.className = "profile-status-msg success";
                statusMsg.textContent = "Volunteer profile saved successfully!";
                statusMsg.classList.remove('hidden');
            }

            // Sync Header Initials
            const initialsSpan = document.getElementById('nav-user-initials');
            if (initialsSpan) initialsSpan.textContent = this.getUserInitials(name);

            // Automatically close modal after 1.2s
            setTimeout(() => {
                this.closeAccountModal();
            }, 1200);

        } catch (err) {
            console.error("Profile save error:", err);
            if (statusMsg) {
                statusMsg.className = "profile-status-msg error";
                statusMsg.textContent = "Error saving profile. Details saved locally.";
                statusMsg.classList.remove('hidden');
            }
        } finally {
            if (spinner) spinner.classList.add('hidden');
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    // Sign Out handler
    async handleSignOut() {
        try {
            if (window.firebaseInstance && window.firebaseInstance.isInitialized) {
                await window.firebaseInstance.signOutUser();
                console.log("User successfully signed out.");
            }
        } catch (e) {
            console.error("Error signing out user:", e);
        } finally {
            // Toggle dropdown close
            const menu = document.getElementById('nav-user-menu');
            const dropdown = document.getElementById('nav-dropdown-menu');
            if (menu) menu.classList.remove('open');
            if (dropdown) dropdown.classList.add('hidden');
        }
    }

    /**
     * Fetch Events directly from hardcoded Contentful CDN
     */
    async fetchEvents() {
        this.showProgressBar(true);
        this.toggleSkeleton(true);

        const url = `https://cdn.contentful.com/spaces/${this.CONTENTFUL_SPACE_ID}/environments/master/entries?access_token=${this.CONTENTFUL_CDN_TOKEN}&content_type=${this.CONTENTFUL_CONTENT_TYPE}`;

        try {
            console.log('Fetching events from Contentful CDN...');
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Contentful CDN API error: ${response.status}`);
            const data = await response.json();
            this.events = data.items || [];
            console.log(`Loaded ${this.events.length} event(s) from Contentful.`);
        } catch (error) {
            console.error('Contentful fetch failed:', error);
            this.events = [];
        }

        // Map and parse all fields
        this.processEventsData();

        this.toggleSkeleton(false);
        this.showProgressBar(false);
    }

    /**
     * Map Contentful fields, parse dates1+dates2, compute statuses
     */
    processEventsData() {
        this.events = this.events.map(event => {
            const fields = event.fields || {};

            // Combine dates1 and dates2 into a single comma-separated string
            const d1 = (fields.dates1 || '').trim();
            const d2 = (fields.dates2 || '').trim();
            const dateStr = d1 && d2 ? `${d1}, ${d2}` : (d1 || d2);

            // Run date parsing utility
            const parsed = this.parseAndFormatDates(dateStr);

            // Dynamic Status Classification
            const status = this.classifyStatus(parsed.firstStartDate, parsed.lastEndDate);

            return {
                id: event.sys.id,
                title: fields.title || 'Untitled Event',
                description: fields.description || 'No description provided.',
                datesTextRaw: dateStr,
                datesFormatted: parsed.formatted,
                firstStartDate: parsed.firstStartDate,
                lastEndDate: parsed.lastEndDate,
                location: fields.location || 'Remote',
                volunteerCount: parseInt(fields.volunteerCount, 10) || 0,
                // Contentful field is volunteerSpecificDetails
                volunteerDetails: fields.volunteerSpecificDetails || fields.volunteerDetails || 'No details provided.',
                typeOfWork: fields.typeOfWork || 'General Support',
                pay: fields.pay || 'Unpaid',
                status: status
            };
        });
    }

    /**
     * Single Date String Parser ("D/M/YYYY")
     */
    parseSingleDateStr(str) {
        if (!str) return null;
        const parts = str.trim().split('/');
        if (parts.length !== 3) return null;
        
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        // Return structured JS date object set at noon to bypass timezone overrides
        return new Date(year, month - 1, day, 12, 0, 0);
    }

    /**
     * Core Date Parser Engine
     * Converts: "2/3/2026 - 6/3/2026, 8/3/2026 - 12/3/2026"
     * Into: "March 2 – March 6 & March 8 – March 12"
     */
    parseAndFormatDates(dateStr) {
        if (!dateStr) {
            return { formatted: 'Date TBD', firstStartDate: null, lastEndDate: null };
        }

        try {
            // Split multiple range segments by comma
            const ranges = dateStr.split(',').map(r => r.trim());
            const formattedSegments = [];
            
            let firstStartDate = null;
            let lastEndDate = null;

            const formatOpt = { month: 'long', day: 'numeric' };

            for (const range of ranges) {
                // Split single range start/end by hyphen
                const parts = range.split('-').map(p => p.trim());
                
                if (parts.length === 1) {
                    // Single date
                    const date = this.parseSingleDateStr(parts[0]);
                    if (date) {
                        formattedSegments.push(date.toLocaleDateString('en-US', formatOpt));
                        if (!firstStartDate || date < firstStartDate) firstStartDate = date;
                        if (!lastEndDate || date > lastEndDate) lastEndDate = date;
                    }
                } else if (parts.length === 2) {
                    // Range start - end
                    const start = this.parseSingleDateStr(parts[0]);
                    const end = this.parseSingleDateStr(parts[1]);
                    
                    if (start && end) {
                        formattedSegments.push(`${start.toLocaleDateString('en-US', formatOpt)} – ${end.toLocaleDateString('en-US', formatOpt)}`);
                        if (!firstStartDate || start < firstStartDate) firstStartDate = start;
                        if (!lastEndDate || end > lastEndDate) lastEndDate = end;
                    }
                }
            }

            return {
                formatted: formattedSegments.join(' & ') || dateStr,
                firstStartDate,
                lastEndDate
            };
        } catch (e) {
            console.error("Critical date parsing exception:", e);
            return { formatted: dateStr, firstStartDate: null, lastEndDate: null };
        }
    }

    /**
     * Compute event status dynamically from dates
     */
    classifyStatus(start, end) {
        if (!start || !end) return 'upcoming';

        // Current Local Date normalized to midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const normalizedStart = new Date(start);
        normalizedStart.setHours(0, 0, 0, 0);

        const normalizedEnd = new Date(end);
        normalizedEnd.setHours(23, 59, 59, 999); // Cover entire end day

        if (today > normalizedEnd) {
            return 'past';
        } else if (today >= normalizedStart && today <= normalizedEnd) {
            return 'ongoing';
        } else {
            return 'upcoming';
        }
    }

    /**
     * Render listing cards onto the home page view
     */
    renderEvents(filter = 'all') {
        const grid = document.getElementById('events-grid');
        const emptyState = document.getElementById('events-empty');
        grid.innerHTML = '';
        
        this.currentFilter = filter;
        
        // Filter elements
        this.filteredEvents = this.events.filter(event => {
            if (filter === 'all') return true;
            return event.status === filter;
        });

        // Toggle active styling on tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            if (tab.dataset.filter === filter) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        if (this.filteredEvents.length === 0) {
            emptyState.classList.remove('hidden');
            grid.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        grid.classList.remove('hidden');

        // Dynamic Card Builder
        this.filteredEvents.forEach(event => {
            const card = document.createElement('div');
            card.className = 'event-card';
            card.onclick = () => this.navigateToDetail(event.id);

            // Scarcity threshold pill (e.g. less than 5 spots left)
            const scarcityBadge = (event.volunteerCount > 0 && event.volunteerCount <= 5 && event.status !== 'past')
                ? `<span class="badge badge-scarcity"><i class="fa-solid fa-fire"></i> Only ${event.volunteerCount} spots left</span>`
                : `<span class="badge"><i class="fa-solid fa-users"></i> ${event.volunteerCount} openings</span>`;

            card.innerHTML = `
                <div class="event-card-media">
                    <span class="status-pill ${event.status}">
                        <span class="dot dot-${event.status}"></span>
                        ${event.status.toUpperCase()}
                    </span>
                    <h3 class="card-title-white">${event.title}</h3>
                </div>
                <div class="event-card-body">
                    <div class="event-card-content">
                        <div class="event-card-date">
                            <i class="fa-regular fa-calendar"></i>
                            <span>${event.datesFormatted}</span>
                        </div>
                        <p class="event-card-desc">${event.description}</p>
                    </div>
                    <div class="event-card-footer">
                        <span class="badge"><i class="fa-solid fa-location-dot"></i> ${event.location.split(',')[0]}</span>
                        <span class="badge"><i class="fa-solid fa-briefcase"></i> ${event.typeOfWork}</span>
                        ${scarcityBadge}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    /**
     * Render the detailed description view page
     */
    renderDetail(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) {
            console.error(`Event with id "${eventId}" not found.`);
            this.navigateToHome();
            return;
        }

        this.activeEvent = event;

        // Populate details elements
        document.getElementById('detail-title').textContent = event.title;
        document.getElementById('detail-dates').textContent = event.datesFormatted;
        document.getElementById('detail-location').textContent = event.location;
        document.getElementById('detail-description').textContent = event.description;
        document.getElementById('detail-volunteer-details').textContent = event.volunteerDetails;
        
        // Sidebar metadata mapping
        document.getElementById('sidebar-work-type').textContent = event.typeOfWork;
        document.getElementById('sidebar-compensation').textContent = event.pay;
        document.getElementById('sidebar-spots').textContent = `${event.volunteerCount} volunteers`;

        // Update Detail Status Pill
        const statusPill = document.getElementById('detail-status-pill');
        statusPill.className = `status-pill ${event.status}`;
        statusPill.innerHTML = `<span class="dot dot-${event.status}"></span> ${event.status.toUpperCase()}`;

        // Scarcity warning dynamic pill
        const scarcityPill = document.getElementById('detail-spots-badge');
        if (event.volunteerCount > 0 && event.volunteerCount <= 5 && event.status !== 'past') {
            scarcityPill.classList.remove('hidden');
            scarcityPill.innerHTML = `<i class="fa-solid fa-fire"></i> Only ${event.volunteerCount} spots left!`;
        } else {
            scarcityPill.classList.add('hidden');
        }

        // Mobile Sticky Dock populate
        document.getElementById('mobile-cta-title').textContent = event.title;
        const mobileSpots = document.getElementById('mobile-cta-spots');
        if (event.volunteerCount > 0 && event.status !== 'past') {
            mobileSpots.textContent = `Only ${event.volunteerCount} openings left`;
            mobileSpots.style.color = '#ef4444';
        } else {
            mobileSpots.textContent = 'Join the team';
            mobileSpots.style.color = 'var(--color-text-secondary)';
        }

        // Disable CTAs if the event has already passed
        const ctaBtns = document.querySelectorAll('.btn-cta, .mobile-cta-btn');
        if (event.status === 'past') {
            ctaBtns.forEach(btn => {
                btn.disabled = true;
                btn.textContent = 'Event Completed';
                btn.style.backgroundColor = 'var(--color-border-subtle)';
                btn.style.color = 'var(--color-text-muted)';
                btn.style.cursor = 'not-allowed';
                btn.style.transform = 'none';
                btn.style.boxShadow = 'none';
            });
        } else {
            ctaBtns.forEach(btn => {
                btn.disabled = false;
                btn.textContent = btn.classList.contains('mobile-cta-btn') ? 'Register' : 'Volunteer Now';
                btn.removeAttribute('style'); // reset stylesheet standard override
            });
        }
    }

    /**
     * Client hash router handler
     */
    handleRouting() {
        const hash = window.location.hash;
        const homeView = document.getElementById('view-home');
        const detailView = document.getElementById('view-detail');

        window.scrollTo(0, 0);

        if (hash.startsWith('#/event/')) {
            const eventId = hash.replace('#/event/', '');
            this.renderDetail(eventId);
            
            homeView.classList.add('hidden');
            detailView.classList.remove('hidden');
            
            document.title = `${this.activeEvent?.title || 'Detail'} — Kirin Events`;
        } else {
            this.renderEvents(this.currentFilter);
            
            detailView.classList.add('hidden');
            homeView.classList.remove('hidden');
            
            document.title = 'Kirin Events — Modern Volunteer Event Platform';
        }
    }

    /**
     * Router navigation triggers
     */
    navigateToHome() {
        window.location.hash = '/';
    }

    navigateToDetail(eventId) {
        window.location.hash = `#/event/${eventId}`;
    }

    filterEvents(filter) {
        this.renderEvents(filter);
    }

    /**
     * Sign Up Modal control triggers
     */
    openSignupModal() {
        if (!this.activeEvent) return;

        // AUTH CHECK: Must be logged in to register for events!
        if (!this.user) {
            console.log("Redirecting to login before volunteer registration.");
            this.pendingRegistration = true;
            this.openAuthModal();
            return;
        }

        // Reset step states
        document.getElementById('modal-form-step').classList.remove('hidden');
        document.getElementById('modal-success-step').classList.add('hidden');
        
        // Reset inputs
        document.getElementById('volunteer-form').reset();

        // Populate subtitle & hidden fields
        document.getElementById('modal-subtitle').innerHTML = `Fill in your details to secure your spot for <strong>${this.activeEvent.title}</strong>`;
        document.getElementById('form-event-title').value = this.activeEvent.title;
        document.getElementById('form-event-id').value = this.activeEvent.id;

        // Auto-fill logged in volunteer details if profile is set
        if (this.userProfile) {
            document.getElementById('volunteer-name').value = this.userProfile.name || '';
            document.getElementById('volunteer-whatsapp').value = this.userProfile.whatsapp || '';
            document.getElementById('volunteer-age').value = this.userProfile.age || '';
            document.getElementById('volunteer-location').value = this.userProfile.location || '';
            document.getElementById('volunteer-experience').value = this.userProfile.experience || '';
        } else {
            // Fallback to Google user name if profile doesn't exist yet
            document.getElementById('volunteer-name').value = this.user.displayName || '';
        }

        // Open backdrop
        document.getElementById('signup-modal').classList.remove('hidden');
        
        // Focus first empty field
        const whatsappInput = document.getElementById('volunteer-whatsapp');
        if (whatsappInput && whatsappInput.value === '') {
            whatsappInput.focus();
        } else {
            document.getElementById('volunteer-name').focus();
        }
    }

    closeSignupModal() {
        document.getElementById('signup-modal').classList.add('hidden');
    }

    /**
     * Submit registration data to Formspree Endpoint
     */
    async submitRegistration(e) {
        e.preventDefault();

        const form = document.getElementById('volunteer-form');
        const submitBtn = document.getElementById('submit-btn');
        const btnText = document.getElementById('btn-text');
        const btnSpinner = document.getElementById('btn-spinner');

        // Loading indicators trigger
        submitBtn.disabled = true;
        btnText.textContent = 'Submitting...';
        btnSpinner.classList.remove('hidden');

        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => data[key] = value);

        // Include metadata for nicer reports inside Formspree dashboard
        data['_subject'] = `New Kirin Volunteer: ${data['Name']} — ${data['Event Name']}`;

        try {
            // Auto-save submitted values to Firebase Profile so user's profile is updated on the fly
            if (this.user) {
                const profileData = {
                    name: data['Name'],
                    whatsapp: data['WhatsApp Number'],
                    age: data['Age'],
                    location: data['Location'],
                    experience: data['Experience']
                };
                this.userProfile = profileData;
                localStorage.setItem(`kirin_profile_${this.user.uid}`, JSON.stringify(profileData));
                
                if (window.firebaseInstance && window.firebaseInstance.isInitialized) {
                    await window.firebaseInstance.saveProfile(this.user.uid, profileData);
                }
            }

            // Live fetch submission to Formspree endpoint
            const endpoint = 'https://formspree.io/f/meedkgbz';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                // Success feedback screen transition
                document.getElementById('success-event-title').textContent = data['Event Name'] || this.activeEvent.title;
                document.getElementById('modal-form-step').classList.add('hidden');
                document.getElementById('modal-success-step').classList.remove('hidden');
            } else {
                throw new Error('Formspree submission rejected by server.');
            }
        } catch (error) {
            console.error("Formspree submission error:", error);
            alert("Oops! There was a problem submitting your registration. Please try again.");
        } finally {
            // Restore button triggers
            submitBtn.disabled = false;
            btnText.textContent = 'Confirm Registration';
            btnSpinner.classList.add('hidden');
        }
    }

    /**
     * UI Loader Utilities
     */
    toggleSkeleton(show) {
        const skeleton = document.getElementById('events-skeleton');
        const grid = document.getElementById('events-grid');
        if (show) {
            skeleton.classList.remove('hidden');
            grid.classList.add('hidden');
        } else {
            skeleton.classList.add('hidden');
            grid.classList.remove('hidden');
        }
    }

    showProgressBar(show) {
        const progressBar = document.getElementById('loading-progress');
        if (show) {
            progressBar.style.width = '30%';
            setTimeout(() => {
                if (progressBar.style.width === '30%') progressBar.style.width = '70%';
            }, 300);
        } else {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.width = '0';
            }, 200);
        }
    }
}

// Global App Instance startup
const app = new KirinEventsApp();
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
