const playwright = require('playwright');
(async () => {
    const browser = await playwright.chromium.launch({ headless: true });
    
    const contextPhone = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    });
    const pagePhone = await contextPhone.newPage();
    await pagePhone.goto('http://localhost:5000');
    await pagePhone.waitForTimeout(1000);
    
    const styles = await pagePhone.evaluate(() => {
        const header = document.getElementById('title_header');
        const headerStyle = window.getComputedStyle(header);
        
        const hamburger = document.querySelector('#title_header .w3-button.w3-large');
        const hamburgerStyle = hamburger ? window.getComputedStyle(hamburger) : null;
        
        const sidebar = document.getElementById('mySidebar');
        const sidebarStyle = window.getComputedStyle(sidebar);
        
        return {
            title_header_display: headerStyle.display,
            title_header_classes: header.className,
            hamburger_display: hamburgerStyle ? hamburgerStyle.display : 'Not found',
            hamburger_classes: hamburger ? hamburger.className : 'Not found',
            sidebar_display: sidebarStyle.display,
            sidebar_classes: sidebar.className
        };
    });
    
    console.log(JSON.stringify(styles, null, 2));
    
    await browser.close();
})();
