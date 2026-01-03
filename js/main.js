// Enhanced main.js with performance optimizations and accessibility features

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initMobileMenu();
    initSmoothScrolling();
    initIntersectionObserver();
    initFormValidation();
    initLoadingStates();
    initLazyLoading();
    initPerformanceOptimizations();
    initAccessibilityFeatures();
    initAIAnimations();
    initNavbarScroll();
    hideLoadingOverlay();
});

// Navbar scroll effect
function initNavbarScroll() {
    const navbar = document.querySelector('.top-navbar');
    if (!navbar) return;
    
    let lastScrollY = window.scrollY;
    
    function handleScroll() {
        const currentScrollY = window.scrollY;
        
        // Add scrolled class when scrolled down
        if (currentScrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScrollY = currentScrollY;
    }
    
    // Use passive listener for better scroll performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    handleScroll();
}

// Mobile menu functionality
function initMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const topNavMenu = document.querySelector('.top-nav-menu');
    
    if (!mobileToggle || !topNavMenu) return;

    function toggleMobileMenu() {
        const isOpen = topNavMenu.classList.contains('active');
        
        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }
    
    function openMobileMenu() {
        topNavMenu.classList.add('active');
        mobileToggle.classList.add('active');
        mobileToggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }
    
    function closeMobileMenu() {
        topNavMenu.classList.remove('active');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    // Event listeners
    mobileToggle.addEventListener('click', toggleMobileMenu);
    
    // Close menu when clicking on a link
    const navLinks = topNavMenu.querySelectorAll('.top-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            setTimeout(() => {
                closeMobileMenu();
            }, 100);
        });
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && topNavMenu.classList.contains('active')) {
            closeMobileMenu();
        }
    });
    
    // Close menu on outside click
    document.addEventListener('click', function(e) {
        if (topNavMenu.classList.contains('active') && 
            !topNavMenu.contains(e.target) && 
            !mobileToggle.contains(e.target)) {
            closeMobileMenu();
        }
    });
    
    // Set initial ARIA state
    mobileToggle.setAttribute('aria-expanded', 'false');
}

// Enhanced smooth scrolling with loading states
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                showLoadingSpinner();
                
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                // Update active link
                updateActiveNavLink(this.getAttribute('href'));
                
                setTimeout(hideLoadingSpinner, 500);
            }
        });
    });
}

// Intersection Observer for animations and active nav links
function initIntersectionObserver() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '-50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // Update active navigation link
                const id = entry.target.getAttribute('id');
                if (id) updateActiveNavLink(`#${id}`);
            }
        });
    }, observerOptions);

    // Observe all sections
    document.querySelectorAll('section').forEach(section => {
        observer.observe(section);
    });

    // Observe cards and timeline items
    document.querySelectorAll('.experience-card, .timeline-item, .publication-item, .award-item').forEach(item => {
        observer.observe(item);
    });
}

// Form validation with accessibility
function initFormValidation() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    const inputs = contactForm.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        // Real-time validation
        input.addEventListener('input', function() {
            validateField(this);
        });

        input.addEventListener('blur', function() {
            validateField(this);
        });
    });

    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let isValid = true;
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });

        if (isValid) {
            submitForm(this);
        } else {
            showErrorMessage('Please fix the errors before submitting.');
        }
    });
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.getAttribute('name');
    let isValid = true;
    let errorMessage = '';

    // Remove existing error states
    field.classList.remove('error');
    removeFieldError(field);

    // Validation rules
    switch (fieldName) {
        case 'name':
            if (value.length < 2) {
                errorMessage = 'Name must be at least 2 characters long.';
                isValid = false;
            }
            break;
        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                errorMessage = 'Please enter a valid email address.';
                isValid = false;
            }
            break;
        case 'message':
            if (value.length < 10) {
                errorMessage = 'Message must be at least 10 characters long.';
                isValid = false;
            }
            break;
    }

    if (!isValid) {
        field.classList.add('error');
        showFieldError(field, errorMessage);
    }

    return isValid;
}

function showFieldError(field, message) {
    let errorElement = field.parentNode.querySelector('.field-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.setAttribute('role', 'alert');
        field.parentNode.appendChild(errorElement);
    }
    errorElement.textContent = message;
}

function removeFieldError(field) {
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
}

// Loading states
function initLoadingStates() {
    // Show loading when page is loading
    window.addEventListener('load', hideLoadingOverlay);
}

function showLoadingSpinner() {
    const spinner = document.querySelector('.loading-spinner');
    if (spinner) spinner.classList.add('active');
}

function hideLoadingSpinner() {
    const spinner = document.querySelector('.loading-spinner');
    if (spinner) spinner.classList.remove('active');
}

function showLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
}

// Lazy loading for images
function initLazyLoading() {
    if ('loading' in HTMLImageElement.prototype) {
        // Native lazy loading supported
        document.querySelectorAll('img[loading="lazy"]').forEach(img => {
            img.addEventListener('load', function() {
                this.classList.add('loaded');
            });
        });
    } else {
        // Fallback for browsers without native lazy loading
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// Performance optimizations
function initPerformanceOptimizations() {
    // Debounce scroll events
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateScrollPosition, 10);
    });

    // Preload critical resources
    preloadCriticalResources();
    
    // Optimize animations
    optimizeAnimations();
}

function preloadCriticalResources() {
    // Preload hero image
    const heroImg = new Image();
    heroImg.src = 'images/profile-compressed.jpg';
    
    // Preload critical CSS if not already loaded
    const criticalCSS = document.createElement('link');
    criticalCSS.rel = 'preload';
    criticalCSS.href = 'css/style.css';
    criticalCSS.as = 'style';
    document.head.appendChild(criticalCSS);
}

function optimizeAnimations() {
    // Reduce motion for users who prefer it
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.style.setProperty('--animation-duration', '0.01ms');
    }
}

// Accessibility features
function initAccessibilityFeatures() {
    // Focus trap for sidebar
    initFocusTrap();
    
    // Announce dynamic content changes
    initAriaLiveRegions();
    
    // High contrast mode detection
    detectHighContrastMode();
}

function initFocusTrap() {
    const sidebar = document.getElementById('sidebar');
    const focusableElements = sidebar.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    sidebar.addEventListener('keydown', function(e) {
        if (e.key !== 'Tab') return;
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });
}

function initAriaLiveRegions() {
    // Create live region for announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
    
    window.announceToScreenReader = function(message) {
        liveRegion.textContent = message;
        setTimeout(() => liveRegion.textContent = '', 1000);
    };
}

function detectHighContrastMode() {
    if (window.matchMedia('(prefers-contrast: high)').matches) {
        document.documentElement.classList.add('high-contrast');
    }
}

// Utility functions
function updateActiveNavLink(href) {
    document.querySelectorAll('.sidebar-link, .top-nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`a[href="${href}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

function updateScrollPosition() {
    const scrolled = window.pageYOffset;
    const rate = scrolled * -0.5;
    
    // Parallax effect for hero background
    const hero = document.querySelector('.hero');
    if (hero && scrolled < window.innerHeight) {
        hero.style.transform = `translateY(${rate}px)`;
    }
}

function submitForm(form) {
    showLoadingSpinner();
    
    // Disable submit button to prevent double submission
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Sending...';
    
    // Prepare form data
    const formData = new FormData(form);
    
    // Submit to Formspree
    fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        hideLoadingSpinner();
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
        
        if (response.ok) {
        showSuccessMessage('Thank you for your message! I will get back to you soon.');
        form.reset();
        
        // Remove validation states
        form.querySelectorAll('.error').forEach(field => {
            field.classList.remove('error');
        });
        form.querySelectorAll('.field-error').forEach(error => {
            error.remove();
        });
            
            // Announce success to screen readers
            if (window.announceToScreenReader) {
                window.announceToScreenReader('Message sent successfully!');
            }
        } else {
            response.json().then(data => {
                if (data.errors) {
                    const errorMessages = data.errors.map(error => error.message).join(', ');
                    showErrorMessage(`Error: ${errorMessages}`);
                } else {
                    showErrorMessage('There was a problem sending your message. Please try again.');
                }
            }).catch(() => {
                showErrorMessage('There was a problem sending your message. Please try again.');
            });
        }
    })
    .catch(error => {
        hideLoadingSpinner();
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
        console.error('Form submission error:', error);
        showErrorMessage('There was a problem sending your message. Please check your connection and try again.');
    });
}

function showErrorMessage(message) {
    showMessage(message, 'error');
}

function showSuccessMessage(message) {
    showMessage(message, 'success');
}

function showMessage(message, type) {
    // Remove existing messages
    document.querySelectorAll('.error-message, .success-message').forEach(msg => {
        msg.remove();
    });
    
    const messageEl = document.createElement('div');
    messageEl.className = `${type}-message show`;
    messageEl.textContent = message;
    messageEl.setAttribute('role', 'alert');
    
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.insertBefore(messageEl, contactForm.firstChild);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => messageEl.remove(), 300);
        }, 5000);
    }
    
    // Announce to screen readers
    if (window.announceToScreenReader) {
        window.announceToScreenReader(message);
    }
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    // Could implement error reporting here
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    // Could implement error reporting here
});

// Screen reader only class for accessibility
const style = document.createElement('style');
style.textContent = `
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
    
    .field-error {
        color: #dc3545;
        font-size: 0.875rem;
        margin-top: 0.25rem;
    }
    
    .error {
        border-color: #dc3545 !important;
        box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1) !important;
    }
`;
document.head.appendChild(style);

// Initialize AI animations and effects
function initAIAnimations() {
    // Add typing effect to hero title
    const heroTitle = document.querySelector('.ai-text');
    if (heroTitle) {
        const text = heroTitle.textContent;
        heroTitle.textContent = '';
        let i = 0;
        
        function typeWriter() {
            if (i < text.length) {
                heroTitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 100);
            }
        }
        
        // Start typing after a short delay
        setTimeout(typeWriter, 1000);
    }
    
    // Add hover effects to AI elements
    const aiElements = document.querySelectorAll('.ai-btn, .expertise-tag, .ai-badge, .vlm-badge, .llm-badge');
    aiElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.05)';
        });
        
        element.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Add click ripple effect to buttons
    const buttons = document.querySelectorAll('.ai-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

// Initialize responsive behavior
function initResponsiveBehavior() {
    // Handle window resize events
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateLayoutForScreenSize();
        }, 250);
    });
    
    // Initial layout update
    updateLayoutForScreenSize();
}

function updateLayoutForScreenSize() {
    const isMobile = window.innerWidth <= 768;
    const topNavMenu = document.querySelector('.top-nav-menu');
    
    if (!isMobile && topNavMenu && topNavMenu.classList.contains('active')) {
        // Close mobile menu on desktop
        topNavMenu.classList.remove('active');
        document.querySelector('.mobile-menu-toggle').classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Initialize responsive behavior
initResponsiveBehavior(); 

// Copy to clipboard functionality
window.copyToClipboard = function(text) {
    if (navigator.clipboard && window.isSecureContext) {
        // Use the modern Clipboard API
        navigator.clipboard.writeText(text).then(() => {
            showSuccessMessage('Citation copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyTextToClipboard(text);
        });
    } else {
        // Fallback for older browsers
        fallbackCopyTextToClipboard(text);
    }
};

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showSuccessMessage('Citation copied to clipboard!');
        } else {
            showErrorMessage('Unable to copy citation. Please copy manually.');
        }
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
        showErrorMessage('Unable to copy citation. Please copy manually.');
    }
    
    document.body.removeChild(textArea);
}

// Privacy and Accessibility Info Functions
window.showPrivacyInfo = function() {
    const message = `
Privacy Notice:
• This website uses no tracking cookies
• Contact form data is processed securely via Formspree
• No personal data is stored on this website
• Email addresses are only used to respond to inquiries
• All external links use proper security attributes
    `;
    showCustomModal('Privacy Information', message);
};

window.showAccessibilityInfo = function() {
    const message = `
Accessibility Features:
• Fully keyboard navigable
• Screen reader compatible with ARIA labels
• High contrast mode support
• Reduced motion support for users who prefer it
• Semantic HTML structure
• Proper heading hierarchy
• Alt text for all images
• Focus indicators on all interactive elements

If you encounter any accessibility issues, please contact me at aydina1@umbc.edu
    `;
    showCustomModal('Accessibility Information', message);
};

function showCustomModal(title, content) {
    // Remove existing modal if any
    const existingModal = document.getElementById('customModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'customModal';
    modal.className = 'custom-modal';
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeCustomModal()"></div>
        <div class="modal-content" role="dialog" aria-labelledby="modalTitle" aria-describedby="modalContent">
            <div class="modal-header">
                <h3 id="modalTitle">${title}</h3>
                <button class="modal-close" onclick="closeCustomModal()" aria-label="Close modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <pre id="modalContent">${content}</pre>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="closeCustomModal()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus trap
    const modalContent = modal.querySelector('.modal-content');
    const focusableElements = modalContent.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    firstElement.focus();
    
    modal.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeCustomModal();
        } else if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });
}

window.closeCustomModal = function() {
    const modal = document.getElementById('customModal');
    if (modal) {
        modal.remove();
    }
};

// Advanced Accessibility Features
function initializeAccessibilityFeatures() {
    initializeAccessibilityMenu();
    initializeKeyboardEnhancements();
    initializeScreenReaderSupport();
    initializeReadingGuide();
    loadAccessibilityPreferences();
}


// Accessibility Menu
function initializeAccessibilityMenu() {
    const toggle = document.getElementById('accessibility-menu-toggle');
    const menu = document.getElementById('accessibility-menu');
    const closeBtn = menu?.querySelector('.accessibility-close');
    const resetBtn = menu?.querySelector('.accessibility-reset');
    
    if (toggle && menu) {
        toggle.addEventListener('click', function() {
            const isOpen = menu.classList.contains('active');
            if (isOpen) {
                closeAccessibilityMenu();
            } else {
                openAccessibilityMenu();
            }
        });
        
        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', closeAccessibilityMenu);
        }
        
        // Reset button
        if (resetBtn) {
            resetBtn.addEventListener('click', resetAccessibilitySettings);
        }
        
        // Close on escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && menu.classList.contains('active')) {
                closeAccessibilityMenu();
            }
        });
        
        // Close on backdrop click
        menu.addEventListener('click', function(e) {
            if (e.target === menu) {
                closeAccessibilityMenu();
            }
        });
        
        // Initialize toggle states
        initializeAccessibilityToggles();
    }
}

function openAccessibilityMenu() {
    const menu = document.getElementById('accessibility-menu');
    const toggle = document.getElementById('accessibility-menu-toggle');
    
    if (menu && toggle) {
        menu.classList.add('active');
        menu.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        
        // Focus first option
        const firstOption = menu.querySelector('input[type="checkbox"]');
        if (firstOption) {
            firstOption.focus();
        }
        
        announceToScreenReader('Accessibility menu opened');
    }
}

function closeAccessibilityMenu() {
    const menu = document.getElementById('accessibility-menu');
    const toggle = document.getElementById('accessibility-menu-toggle');
    
    if (menu && toggle) {
        menu.classList.remove('active');
        menu.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
        
        announceToScreenReader('Accessibility menu closed');
    }
}

// Accessibility Toggle Functions
function initializeAccessibilityToggles() {
    const toggles = {
        'high-contrast-toggle': toggleHighContrast,
        'large-text-toggle': toggleLargeText,
        'focus-highlight-toggle': toggleEnhancedFocus,
        'reduce-motion-toggle': toggleReducedMotion,
        'keyboard-nav-toggle': toggleEnhancedKeyboard,
        'nav-announcements-toggle': toggleNavigationAnnouncements,
        'reading-guide-toggle': toggleReadingGuide,
        'dyslexia-font-toggle': toggleDyslexiaFont
    };
    
    Object.entries(toggles).forEach(([id, handler]) => {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.addEventListener('change', handler);
        }
    });
}

// Individual Toggle Functions
function toggleHighContrast() {
    const isEnabled = document.getElementById('high-contrast-toggle').checked;
    document.body.classList.toggle('high-contrast', isEnabled);
    saveAccessibilityPreference('highContrast', isEnabled);
    announceToScreenReader(`High contrast mode ${isEnabled ? 'enabled' : 'disabled'}`);
}

function toggleLargeText() {
    const isEnabled = document.getElementById('large-text-toggle').checked;
    document.body.classList.toggle('large-text', isEnabled);
    saveAccessibilityPreference('largeText', isEnabled);
    announceToScreenReader(`Large text mode ${isEnabled ? 'enabled' : 'disabled'}`);
}

function toggleEnhancedFocus() {
    const isEnabled = document.getElementById('focus-highlight-toggle').checked;
    document.body.classList.toggle('enhanced-focus', isEnabled);
    saveAccessibilityPreference('enhancedFocus', isEnabled);
    announceToScreenReader(`Enhanced focus indicators ${isEnabled ? 'enabled' : 'disabled'}`);
}

function toggleReducedMotion() {
    const isEnabled = document.getElementById('reduce-motion-toggle').checked;
    document.body.classList.toggle('reduce-motion', isEnabled);
    saveAccessibilityPreference('reducedMotion', isEnabled);
    announceToScreenReader(`Reduced motion ${isEnabled ? 'enabled' : 'disabled'}`);
}

function toggleEnhancedKeyboard() {
    const isEnabled = document.getElementById('keyboard-nav-toggle').checked;
    document.body.classList.toggle('enhanced-keyboard', isEnabled);
    saveAccessibilityPreference('enhancedKeyboard', isEnabled);
    announceToScreenReader(`Enhanced keyboard navigation ${isEnabled ? 'enabled' : 'disabled'}`);
}

function toggleNavigationAnnouncements() {
    const isEnabled = document.getElementById('nav-announcements-toggle').checked;
    window.navigationAnnouncementsEnabled = isEnabled;
    saveAccessibilityPreference('navigationAnnouncements', isEnabled);
    announceToScreenReader(`Navigation announcements ${isEnabled ? 'enabled' : 'disabled'}`);
}

function toggleReadingGuide() {
    const isEnabled = document.getElementById('reading-guide-toggle').checked;
    const guide = document.getElementById('reading-guide');
    
    if (guide) {
        guide.classList.toggle('active', isEnabled);
        guide.setAttribute('aria-hidden', !isEnabled);
    }
    
    if (isEnabled) {
        initializeReadingGuideTracking();
    } else {
        removeReadingGuideTracking();
    }
    
    saveAccessibilityPreference('readingGuide', isEnabled);
    announceToScreenReader(`Reading guide ${isEnabled ? 'enabled' : 'disabled'}`);
}

function toggleDyslexiaFont() {
    const isEnabled = document.getElementById('dyslexia-font-toggle').checked;
    document.body.classList.toggle('dyslexia-font', isEnabled);
    saveAccessibilityPreference('dyslexiaFont', isEnabled);
    announceToScreenReader(`Dyslexia-friendly font ${isEnabled ? 'enabled' : 'disabled'}`);
}

// Reading Guide Functionality
function initializeReadingGuide() {
    const guide = document.getElementById('reading-guide');
    if (guide) {
        guide.style.top = '0px';
    }
}

function initializeReadingGuideTracking() {
    document.addEventListener('mousemove', updateReadingGuide);
}

function removeReadingGuideTracking() {
    document.removeEventListener('mousemove', updateReadingGuide);
}

function updateReadingGuide(e) {
    const guide = document.getElementById('reading-guide');
    if (guide && guide.classList.contains('active')) {
        guide.style.top = (e.clientY - 1) + 'px';
    }
}

// Enhanced Keyboard Navigation
function initializeKeyboardEnhancements() {
    // Enhanced arrow key navigation for menu
    const navLinks = document.querySelectorAll('.top-nav-link');
    
    navLinks.forEach((link, index) => {
        link.addEventListener('keydown', function(e) {
            if (!document.body.classList.contains('enhanced-keyboard')) return;
            
            let targetIndex;
            
            switch(e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    targetIndex = (index + 1) % navLinks.length;
                    navLinks[targetIndex].focus();
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    targetIndex = (index - 1 + navLinks.length) % navLinks.length;
                    navLinks[targetIndex].focus();
                    break;
                case 'Home':
                    e.preventDefault();
                    navLinks[0].focus();
                    break;
                case 'End':
                    e.preventDefault();
                    navLinks[navLinks.length - 1].focus();
                    break;
            }
        });
        
        link.addEventListener('focus', function() {
            if (window.navigationAnnouncementsEnabled) {
                announceToScreenReader(`Focused on ${this.textContent.trim()}`);
            }
        });
    });
    
    // Enhanced form navigation
    const formInputs = document.querySelectorAll('input, textarea, select, button');
    formInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.classList.add('focus-glow');
            setTimeout(() => {
                this.classList.remove('focus-glow');
            }, 600);
        });
    });
}

// Screen Reader Support
function initializeScreenReaderSupport() {
    // Announce page sections when they come into view
    const sections = document.querySelectorAll('section[id]');
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && window.navigationAnnouncementsEnabled) {
                const sectionName = entry.target.querySelector('h1, h2, h3')?.textContent || 
                                  entry.target.getAttribute('aria-label') || 
                                  entry.target.id.replace('-', ' ');
                announceToScreenReader(`Entering ${sectionName} section`);
            }
        });
    }, { threshold: 0.5 });
    
    sections.forEach(section => {
        sectionObserver.observe(section);
    });
}

function announceToScreenReader(message, priority = 'polite') {
    const announcer = document.getElementById(priority === 'assertive' ? 'sr-alerts' : 'sr-status');
    if (announcer) {
        // Clear previous message
        announcer.textContent = '';
        
        // Add new message after a brief delay to ensure it's announced
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
        
        // Clear message after it's been announced
        setTimeout(() => {
            announcer.textContent = '';
        }, 3000);
    }
}

// Accessibility Preferences
function saveAccessibilityPreference(key, value) {
    try {
        const preferences = JSON.parse(localStorage.getItem('accessibilityPreferences') || '{}');
        preferences[key] = value;
        localStorage.setItem('accessibilityPreferences', JSON.stringify(preferences));
    } catch (e) {
        console.warn('Could not save accessibility preference:', e);
    }
}

function loadAccessibilityPreferences() {
    try {
        const preferences = JSON.parse(localStorage.getItem('accessibilityPreferences') || '{}');
        
        // Apply saved preferences
        Object.entries(preferences).forEach(([key, value]) => {
            const toggleId = key.replace(/([A-Z])/g, '-$1').toLowerCase() + '-toggle';
            const toggle = document.getElementById(toggleId);
            
            if (toggle) {
                toggle.checked = value;
                // Trigger the change event to apply the setting
                toggle.dispatchEvent(new Event('change'));
            }
        });
    } catch (e) {
        console.warn('Could not load accessibility preferences:', e);
    }
}

function resetAccessibilitySettings() {
    // Reset all toggles
    const toggles = document.querySelectorAll('#accessibility-menu input[type="checkbox"]');
    toggles.forEach(toggle => {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
    });
    
    // Clear localStorage
    try {
        localStorage.removeItem('accessibilityPreferences');
    } catch (e) {
        console.warn('Could not clear accessibility preferences:', e);
    }
    
    announceToScreenReader('All accessibility settings have been reset');
}

// Initialize accessibility features when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add to existing initialization
    initializeAccessibilityFeatures();
    initializeAccessibilityBadge();
    initializeCommitmentBanner();
    
    // Add keyboard shortcut to toggle accessibility menu (Alt + A)
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            const toggle = document.getElementById('accessibility-menu-toggle');
            const menu = document.getElementById('accessibility-menu');
            
            if (toggle && menu) {
                const isActive = document.body.classList.contains('accessibility-active');
                
                if (isActive) {
                    // Hide accessibility features
                    toggle.classList.remove('show');
                    document.body.classList.remove('accessibility-active');
                    closeAccessibilityMenu();
                    announceToScreenReader('Accessibility menu hidden.');
                } else {
                    // Show accessibility features
                    toggle.classList.add('show');
                    document.body.classList.add('accessibility-active');
                    openAccessibilityMenu();
                    announceToScreenReader('Accessibility menu activated. Press Alt+A again to hide.');
                }
            }
        }
    });
});

// Accessibility Badge Functions
function initializeAccessibilityBadge() {
    const badge = document.querySelector('.badge-trigger');
    if (badge) {
        badge.addEventListener('click', function() {
            const toggle = document.getElementById('accessibility-menu-toggle');
            const menu = document.getElementById('accessibility-menu');
            
            if (toggle && menu) {
                toggle.classList.add('show');
                document.body.classList.add('accessibility-active');
                openAccessibilityMenu();
                announceToScreenReader('Accessibility menu opened');
            }
        });
    }
}

// Commitment Banner Functions
function initializeCommitmentBanner() {
    const banner = document.querySelector('.a11y-commitment-banner');
    const closeBtn = document.querySelector('.close-banner');
    
    // Check if banner was previously closed
    const bannerClosed = localStorage.getItem('a11y-banner-closed');
    
    if (bannerClosed) {
        banner.classList.add('hidden');
    } else {
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (banner && !banner.classList.contains('hidden')) {
                banner.classList.add('hidden');
            }
        }, 10000);
    }
    
    // Close button handler
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            banner.classList.add('hidden');
            localStorage.setItem('a11y-banner-closed', 'true');
            announceToScreenReader('Accessibility banner closed');
        });
    }
}

// ========================================
// CITATION COPY FUNCTION
// ========================================

function copyToClipboard(text) {
    // Try using the modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function() {
            showCitationNotification('Citation copied to clipboard!');
        }).catch(function(err) {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        // Fallback for older browsers or non-HTTPS
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCitationNotification('Citation copied to clipboard!');
        } else {
            showCitationNotification('Failed to copy citation', 'error');
        }
    } catch (err) {
        showCitationNotification('Failed to copy citation', 'error');
    }
    
    document.body.removeChild(textArea);
}

function showCitationNotification(message, type = 'success') {
    // Remove any existing notifications
    const existingNotif = document.querySelector('.citation-notification');
    if (existingNotif) {
        existingNotif.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `citation-notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Hide and remove notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// ========================================
// PROJECT MODAL SYSTEM
// ========================================

const projectData = {
    project1: {
        title: 'Medical Image Segmentation Platform',
        category: 'Deep Learning',
        year: '2024',
        status: 'Active',
        overview: 'Comprehensive deep learning platform designed for automated medical image analysis and segmentation using state-of-the-art multi-task learning approaches to handle imbalanced medical datasets.',
        objectives: [
            'Develop robust segmentation models for various medical imaging modalities',
            'Handle class imbalance using novel sampling strategies',
            'Implement multi-task learning for simultaneous segmentation and classification',
            'Achieve real-time inference for clinical deployment'
        ],
        features: [
            'Multi-task neural network combining segmentation and classification',
            'Advanced data augmentation pipeline for medical images',
            'Handling of highly imbalanced datasets with focal loss',
            'Support for multiple imaging modalities (CT, MRI, X-Ray)',
            'Real-time visualization dashboard'
        ],
        technologies: ['PyTorch', 'TorchVision', 'NumPy', 'Scikit-learn', 'OpenCV', 'MONAI', 'TensorBoard'],
        results: 'Achieved 92% Dice coefficient on polyp segmentation and 95% accuracy on multi-class classification. Significantly improved performance on minority classes.',
        github: 'https://github.com/Ayanzadeh93'
    },
    project2: {
        title: 'LLM-Based Indoor Navigation System',
        category: 'LLM Application',
        year: '2024',
        status: 'Under Review',
        overview: 'Innovative navigation system leveraging Large Language Models and computer vision to assist visually impaired individuals navigate complex indoor environments with real-time guidance.',
        objectives: [
            'Create accessible navigation solution for visually impaired users',
            'Integrate LLMs for natural language interaction',
            'Provide real-time environmental awareness',
            'Enable independent navigation in unfamiliar spaces'
        ],
        features: [
            'GPT-4 powered natural language processing',
            'Computer vision pipeline for obstacle detection',
            'Real-time audio feedback with spatial cues',
            'Dynamic path planning with obstacle avoidance',
            'Indoor positioning using visual odometry',
            'Multi-modal feedback (audio, haptic)'
        ],
        technologies: ['Python', 'GPT-4 API', 'OpenCV', 'YOLOv8', 'PyTorch', 'ROS', 'Text-to-Speech'],
        results: 'Demonstrated at STARS Celebration 2024 and CMD-IT/ACM Richard Tapia Conference. 87% improvement in navigation confidence for visually impaired participants.',
        github: 'https://github.com/Ayanzadeh93'
    },
    project3: {
        title: 'Knowledge Distillation Framework',
        category: 'Model Optimization',
        year: '2023',
        status: 'Published',
        overview: 'Novel framework for efficient knowledge distillation implementing hint-based learning with layer clustering for model compression while maintaining high accuracy.',
        objectives: [
            'Reduce model size while preserving accuracy',
            'Develop novel hint selection strategy',
            'Enable deployment on resource-constrained devices',
            'Improve knowledge transfer efficiency'
        ],
        features: [
            'PURSUhInT algorithm for intelligent hint identification',
            'Layer-wise clustering for optimal knowledge transfer',
            'Flexible teacher-student architecture support',
            'Automated hyperparameter tuning',
            'Support for various architectures (ResNet, VGG, MobileNet)'
        ],
        technologies: ['PyTorch', 'Scikit-learn', 'NumPy', 'K-means Clustering', 'CIFAR-10/100', 'ImageNet'],
        results: 'Published in Expert Systems with Applications (IF: 8.5). Achieved 2.5x compression with only 1.2% accuracy drop. Outperformed traditional methods by 3-5%.',
        github: 'https://github.com/Ayanzadeh93'
    },
    project4: {
        title: 'Vision-Language Medical Models',
        category: 'Multimodal AI',
        year: '2024',
        status: 'In Progress',
        overview: 'Custom implementation of vision-language models with enhanced multimodal learning capabilities specifically designed for medical imaging applications.',
        objectives: [
            'Bridge gap between medical imaging and clinical reports',
            'Enable natural language queries for medical databases',
            'Improve diagnostic accuracy through multimodal learning',
            'Develop interpretable AI systems for healthcare'
        ],
        features: [
            'Custom CLIP-based architecture for medical domain',
            'Contrastive learning with medical image-text pairs',
            'Zero-shot classification for rare conditions',
            'Medical report generation from imaging',
            'Cross-modal retrieval for similar cases',
            'Attention visualization for interpretability'
        ],
        technologies: ['PyTorch', 'Transformers', 'CLIP', 'BERT', 'Vision Transformer', 'Hugging Face'],
        results: 'Achieved 89% accuracy on zero-shot medical image classification. Generated clinically relevant descriptions with 0.85 BLEU score.',
        github: 'https://github.com/Ayanzadeh93'
    },
    project5: {
        title: 'Graph Autoencoder Framework',
        category: 'Graph Learning',
        year: '2020',
        status: 'Published',
        overview: 'Advanced GNN implementation featuring residual connections in graph autoencoders for improved representation learning on complex graph-structured data.',
        objectives: [
            'Improve graph representation with residual connections',
            'Enable unsupervised learning on graphs',
            'Handle large-scale graph datasets efficiently',
            'Preserve graph topology in representations'
        ],
        features: [
            'Graph autoencoder with residual connections',
            'Scalable implementation for large graphs',
            'Unsupervised node embedding generation',
            'Graph reconstruction with high fidelity',
            'Support for various graph types',
            'Visualization tools for learned embeddings'
        ],
        technologies: ['PyTorch', 'PyTorch Geometric', 'NetworkX', 'Scikit-learn', 'NumPy'],
        results: 'Published in IEEE SIU 2020 and arXiv. Achieved 94% accuracy on node classification. Improved graph reconstruction by 15%.',
        github: 'https://github.com/Ayanzadeh93'
    },
    project6: {
        title: 'ML Data Pipeline System',
        category: 'Data Engineering',
        year: '2023',
        status: 'Production',
        overview: 'Scalable data processing pipeline for ML workflows with automated preprocessing, feature engineering, and quality validation.',
        objectives: [
            'Automate data preprocessing for ML workflows',
            'Ensure data quality and consistency',
            'Enable scalable processing of large datasets',
            'Reduce time from raw data to model training'
        ],
        features: [
            'Automated data ingestion from multiple sources',
            'Distributed processing with Apache Spark',
            'Feature engineering with custom transformers',
            'Data quality checks and validation',
            'Dataset and transformation versioning',
            'Integration with MLflow for tracking',
            'Real-time monitoring and alerting'
        ],
        technologies: ['Python', 'Apache Spark', 'Apache Airflow', 'Docker', 'PostgreSQL', 'MLflow', 'AWS S3'],
        results: 'Reduced preprocessing time by 75%. Processing 10TB+ daily with 99.9% uptime. Serving 15+ ML models in production.',
        github: 'https://github.com/Ayanzadeh93'
    }
};

function openProjectModal(projectId) {
    const project = projectData[projectId];
    if (!project) return;
    
    const modal = document.createElement('div');
    modal.className = 'project-modal';
    modal.id = 'projectModal';
    
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <button class="modal-close" onclick="closeProjectModal()">
                    <i class="fas fa-times"></i>
                </button>
                <h2>${project.title}</h2>
                <div class="modal-meta">
                    <span><i class="fas fa-tag"></i> ${project.category}</span>
                    <span><i class="fas fa-calendar"></i> ${project.year}</span>
                    <span><i class="fas fa-circle"></i> ${project.status}</span>
                </div>
            </div>
            
            <div class="modal-body">
                <div class="modal-section">
                    <h3><i class="fas fa-align-left"></i> Overview</h3>
                    <p>${project.overview}</p>
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-bullseye"></i> Objectives</h3>
                    <ul>
                        ${project.objectives.map(obj => `<li>${obj}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-star"></i> Key Features</h3>
                    <ul>
                        ${project.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-tools"></i> Technologies</h3>
                    <div class="tech-stack-grid">
                        ${project.technologies.map(tech => `<span class="tech-item">${tech}</span>`).join('')}
                    </div>
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-chart-line"></i> Results & Impact</h3>
                    <p>${project.results}</p>
                </div>
                
                <div class="modal-section">
                    <a href="${project.github}" target="_blank" class="github-link">
                        <i class="fab fa-github"></i>
                        <span>View on GitHub</span>
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('active'), 10);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeProjectModal();
    });
    
    document.addEventListener('keydown', handleEscapeKey);
    document.body.style.overflow = 'hidden';
}

function closeProjectModal() {
    const modal = document.getElementById('projectModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
        }, 300);
    }
    document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') closeProjectModal();
}

window.openProjectModal = openProjectModal;
window.closeProjectModal = closeProjectModal;

// News Ribbon Carousel
function initNewsCarousel() {
    const newsRibbon = document.getElementById('newsRibbon');
    const prevBtn = document.getElementById('newsPrev');
    const nextBtn = document.getElementById('newsNext');
    
    if (!newsRibbon || !prevBtn || !nextBtn) return;
    
    const scrollAmount = 320; // Width of item + gap
    
    prevBtn.addEventListener('click', () => {
        newsRibbon.scrollBy({
            left: -scrollAmount,
            behavior: 'smooth'
        });
    });
    
    nextBtn.addEventListener('click', () => {
        newsRibbon.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    });
    
    // Update button visibility based on scroll position
    function updateButtons() {
        const maxScroll = newsRibbon.scrollWidth - newsRibbon.clientWidth;
        prevBtn.style.opacity = newsRibbon.scrollLeft > 0 ? '1' : '0.5';
        nextBtn.style.opacity = newsRibbon.scrollLeft < maxScroll - 10 ? '1' : '0.5';
    }
    
    newsRibbon.addEventListener('scroll', updateButtons);
    updateButtons();
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsCarousel);
} else {
    initNewsCarousel();
} 