
import threading
import queue
import time
import requests
import logging
from ..config_manager import config_manager

logger = logging.getLogger("WebhookDispatcher")

class WebhookDispatcher:
    """
    Async Worker to dispatch alerts to configured webhooks.
    Includes Retry Logic and Timeout protection.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(WebhookDispatcher, cls).__new__(cls)
                    cls._instance.queue = queue.Queue()
                    cls._instance.running = True
                    cls._instance.worker = threading.Thread(target=cls._instance._worker_loop, name="WebhookWorker", daemon=True)
                    cls._instance.worker.start()
        return cls._instance

    def send_alert(self, alert_payload: dict):
        """
        Enqueue an alert for dispatch.
        """
        conf = config_manager.webhook
        if not conf.enabled or not conf.endpoints:
            return

        self.queue.put(alert_payload)

    def _worker_loop(self):
        while self.running:
            try:
                payload = self.queue.get(timeout=1.0)
            except queue.Empty:
                continue

            conf = config_manager.webhook
            
            for url in conf.endpoints:
                self._attempt_send(url, payload, conf.retry_count, conf.timeout_seconds)
            
            self.queue.task_done()

    def _attempt_send(self, url: str, payload: dict, retries: int, timeout: int):
        attempt = 0
        while attempt <= retries:
            try:
                response = requests.post(url, json=payload, timeout=timeout)
                if response.status_code in [200, 201, 202]:
                    logger.info(f"Webhook delivered to {url}")
                    return
                else:
                    logger.warning(f"Webhook failed {url} [Status: {response.status_code}]")
            except Exception as e:
                logger.error(f"Webhook error {url}: {e}")
            
            attempt += 1
            time.sleep(1 * attempt) # Exponential backoffish

webhook_dispatcher = WebhookDispatcher()
