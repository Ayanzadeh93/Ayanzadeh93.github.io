// Blog specific JavaScript functionality

// Newsletter form handling
const newsletterForm = document.querySelector('.newsletter-form');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const emailInput = this.querySelector('input[type="email"]');
        const submitButton = this.querySelector('button');
        const originalText = submitButton.innerHTML;
        
        // Show loading state
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
        submitButton.disabled = true;
        
        // Simulate API call (replace with actual newsletter service)
        setTimeout(() => {
            // Success state
            submitButton.innerHTML = '<i class="fas fa-check"></i> Subscribed!';
            submitButton.style.background = '#28a745';
            emailInput.value = '';
            
            // Reset after 3 seconds
            setTimeout(() => {
                submitButton.innerHTML = originalText;
                submitButton.style.background = '';
                submitButton.disabled = false;
            }, 3000);
        }, 1500);
    });
}

// Load more posts functionality
const loadMoreBtn = document.querySelector('.load-more-btn');
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function() {
        const originalText = this.innerHTML;
        
        // Show loading state
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        this.disabled = true;
        
        // Simulate loading more posts
        setTimeout(() => {
            // Create dummy posts (in a real application, you'd fetch from an API)
            const blogGrid = document.querySelector('.blog-grid');
            const newPosts = createDummyPosts(3);
            
            newPosts.forEach((post, index) => {
                setTimeout(() => {
                    blogGrid.appendChild(post);
                    // Trigger animation
                    requestAnimationFrame(() => {
                        post.style.opacity = '1';
                        post.style.transform = 'translateY(0)';
                    });
                }, index * 200);
            });
            
            // Reset button
            this.innerHTML = originalText;
            this.disabled = false;
            
            // After loading 2 times, hide the button (simulate no more posts)
            const loadCount = parseInt(this.dataset.loadCount || '0') + 1;
            this.dataset.loadCount = loadCount;
            
            if (loadCount >= 2) {
                this.style.display = 'none';
                const noMoreText = document.createElement('p');
                noMoreText.textContent = 'No more posts to load';
                noMoreText.style.textAlign = 'center';
                noMoreText.style.color = 'var(--text-light)';
                noMoreText.style.fontStyle = 'italic';
                this.parentNode.appendChild(noMoreText);
            }
        }, 1500);
    });
}

// Function to create dummy blog posts
function createDummyPosts(count) {
    const posts = [];
    const dummyData = [
        {
            title: "Understanding Transformer Networks in Computer Vision",
            excerpt: "An exploration of how transformer architectures are revolutionizing computer vision tasks beyond traditional CNNs.",
            date: "September 1, 2024",
            readTime: "7 min read",
            tags: ["Transformers", "Computer Vision", "Architecture"]
        },
        {
            title: "Ethical Considerations in Medical AI Development",
            excerpt: "Discussing the importance of fairness, transparency, and patient privacy in medical AI systems.",
            date: "August 18, 2024",
            readTime: "6 min read",
            tags: ["Ethics", "Medical AI", "Privacy"]
        },
        {
            title: "Building Robust AI Systems with Uncertainty Quantification",
            excerpt: "How to incorporate uncertainty measures to make AI systems more reliable and trustworthy.",
            date: "August 3, 2024",
            readTime: "9 min read",
            tags: ["Uncertainty", "Robust AI", "Reliability"]
        },
        {
            title: "The Future of Federated Learning in Healthcare",
            excerpt: "Exploring how federated learning can enable collaborative AI development while preserving data privacy.",
            date: "July 20, 2024",
            readTime: "8 min read",
            tags: ["Federated Learning", "Healthcare", "Privacy"]
        },
        {
            title: "Attention Mechanisms: Beyond Self-Attention",
            excerpt: "A comprehensive look at various attention mechanisms and their applications in different domains.",
            date: "July 5, 2024",
            readTime: "10 min read",
            tags: ["Attention", "Deep Learning", "Architecture"]
        }
    ];
    
    for (let i = 0; i < count && i < dummyData.length; i++) {
        const data = dummyData[i];
        const article = document.createElement('article');
        article.className = 'blog-post';
        article.style.opacity = '0';
        article.style.transform = 'translateY(20px)';
        article.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        article.innerHTML = `
            <div class="post-image">
                <img src="images/blog/placeholder-${i + 1}.jpg" alt="${data.title}" onerror="this.style.display='none'">
            </div>
            <div class="post-content">
                <div class="post-meta">
                    <span class="post-date"><i class="fas fa-calendar"></i> ${data.date}</span>
                    <span class="post-read-time"><i class="fas fa-clock"></i> ${data.readTime}</span>
                </div>
                <h3 class="post-title">${data.title}</h3>
                <p class="post-excerpt">${data.excerpt}</p>
                <div class="post-tags">
                    ${data.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                <a href="#" class="read-more-btn">Read More <i class="fas fa-arrow-right"></i></a>
            </div>
        `;
        
        posts.push(article);
    }
    
    return posts;
}

// Smooth scroll for anchor links that go to main page
document.addEventListener('DOMContentLoaded', function() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link[href^="index.html#"]');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Let the default behavior handle navigation to index.html with anchor
            // The main.js will handle the smooth scrolling once the page loads
        });
    });
});

// Blog post hover effects
document.addEventListener('DOMContentLoaded', function() {
    const blogPosts = document.querySelectorAll('.blog-post');
    
    blogPosts.forEach(post => {
        const readMoreBtn = post.querySelector('.read-more-btn');
        
        if (readMoreBtn) {
            readMoreBtn.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Add click animation
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
                
                // In a real application, you would navigate to the full post
                console.log('Navigate to full post:', post.querySelector('.post-title').textContent);
            });
        }
    });
});

// Search functionality (if you want to add it later)
function initBlogSearch() {
    const searchInput = document.querySelector('.blog-search');
    const blogPosts = document.querySelectorAll('.blog-post');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            
            blogPosts.forEach(post => {
                const title = post.querySelector('.post-title').textContent.toLowerCase();
                const excerpt = post.querySelector('.post-excerpt').textContent.toLowerCase();
                const tags = Array.from(post.querySelectorAll('.tag')).map(tag => tag.textContent.toLowerCase());
                
                const isMatch = title.includes(searchTerm) || 
                               excerpt.includes(searchTerm) || 
                               tags.some(tag => tag.includes(searchTerm));
                
                post.style.display = isMatch ? 'block' : 'none';
            });
        });
    }
}

// Initialize search if needed
// initBlogSearch(); 