import sys
from PySide6.QtWidgets import QApplication, QPushButton

print("Starting Qt Test...")
app = QApplication(sys.argv)
button = QPushButton("Test Button - Click to Close")
button.clicked.connect(app.quit)
button.resize(300, 100)
button.show()
print("Window shown. Entering event loop...")
sys.exit(app.exec())
