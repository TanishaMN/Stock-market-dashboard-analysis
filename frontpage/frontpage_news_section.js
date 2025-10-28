window.addEventListener('DOMContentLoaded', () => {
    const newsContent = document.getElementById('news-content');

    async function fetchTopNews() {
        const newsApiUrl = `https://finnhub.io/api/v1/news?category=general&token=d33fedpr01qib1p0pqj0d33fedpr01qib1p0pqjg`;

        try {
            const response = await fetch(newsApiUrl);
            const newsData = await response.json();
            
            newsContent.innerHTML = ''; // Clear previous news

            if (newsData && newsData.length > 0) {
                const featuredNews = newsData[0];
                const sideNews = newsData.slice(1, 6);

                const featuredCard = document.createElement('a');
                featuredCard.href = featuredNews.url;
                featuredCard.target = '_blank';
                featuredCard.rel = 'noopener noreferrer';
                featuredCard.classList.add('featured-news-card');

                const imageUrl = featuredNews.image && featuredNews.image !== '' ? featuredNews.image : 'https://via.placeholder.com/1400x400/4a4a4a/ffffff?text=Image+Not+Available';
                featuredCard.style.backgroundImage = `url('${imageUrl}')`;

                featuredCard.innerHTML = `
                    <div class="featured-news-text">
                        <div class="featured-news-date">${new Date(featuredNews.datetime * 1000).toLocaleDateString()}</div>
                        <h4 class="featured-news-headline">${featuredNews.headline}</h4>
                    </div>
                `;

                const sideNewsList = document.createElement('div');
                sideNewsList.classList.add('side-news-list');
                
                sideNews.forEach(item => {
                    const sideItem = document.createElement('div');
                    sideItem.classList.add('side-news-item');
                    sideItem.innerHTML = `
                        <a href="${item.url}" target="_blank" rel="noopener noreferrer">
                            <span class="side-news-headline">${item.headline}</span>
                        </a>
                    `;
                    sideNewsList.appendChild(sideItem);
                });

                newsContent.appendChild(featuredCard);
                newsContent.appendChild(sideNewsList);
            } else {
                newsContent.innerHTML = '<div class="no-news-message">No trending news available at the moment.</div>';
            }
        } catch (error) {
            console.error('Failed to fetch news:', error);
            newsContent.innerHTML = '<div class="no-news-message">Failed to load news. Please try again later.</div>';
        }
    }
    
    fetchTopNews();
    setInterval(fetchTopNews, 300000); // Refresh news every 5 minutes (300,000 ms)
});