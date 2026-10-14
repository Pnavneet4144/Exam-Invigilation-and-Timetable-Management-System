const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

const oldSidebarBlock = `
          <div className="my-4 border-t border-gray-700 pt-4">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Coming in Phase 4</h3>
            <NavLink
              to="/regular-duty"
              className={({ isActive }) => \`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 \${
                isActive
                  ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white border-l-4 border-transparent'
              }\`}
            >
              <span className="mr-3 text-lg">📝</span> Regular Exam Duty
            </NavLink>
          </div>`;

const newSidebarBlock = `
          <NavLink 
            to={\`\${basePath}/main-exam-duty\`}
            className={({ isActive }) => \`block px-4 py-3 rounded-lg transition-colors \${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}\`}
          >
            <span className="mr-3">📅</span> Main Exam Duty
          </NavLink>`;

content = content.replace(oldSidebarBlock, newSidebarBlock);

fs.writeFileSync('frontend/src/components/Layout.jsx', content);
