
import time
from datetime import datetime
from ..config_manager import config_manager

class AttendanceRules:
    """
    Evaluates raw timestamps against Organization Policy.
    """
    
    @staticmethod
    def evaluate_check_in(timestamp: float) -> list:
        flags = []
        conf = config_manager.attendance
        work_start = config_manager.general.work_start # "09:00"
        
        # Parse times
        dt = datetime.fromtimestamp(timestamp)
        start_dt = datetime.strptime(f"{dt.date()} {work_start}", "%Y-%m-%d %H:%M").replace(year=dt.year, month=dt.month, day=dt.day)
        
        # Late Check
        minutes_late = (dt - start_dt).total_seconds() / 60
        if minutes_late > conf.grace_period_minutes:
            if minutes_late > conf.late_threshold_minutes:
                # Could be VERY_LATE or HALF_DAY depending on policy
                pass 
            flags.append("LATE")
            
        return flags

    @staticmethod
    def evaluate_check_out(check_in: float, check_out: float) -> list:
        flags = []
        conf = config_manager.attendance
        work_end = config_manager.general.work_end # "17:00"
        
        dt_out = datetime.fromtimestamp(check_out)
        end_dt = datetime.strptime(f"{dt_out.date()} {work_end}", "%Y-%m-%d %H:%M").replace(year=dt_out.year, month=dt_out.month, day=dt_out.day)
        
        # Early Leave
        minutes_early = (end_dt - dt_out).total_seconds() / 60
        if minutes_early > conf.early_leave_threshold_minutes:
            flags.append("EARLY_LEAVE")
            
        # Duration Check
        duration_hours = (check_out - check_in) / 3600
        if duration_hours < 4.0: # Minimum 4 hours for valid day
            flags.append("SHORT_DAY")
            
        return flags

    @staticmethod
    def is_valid_entry_zone(zone_id: str) -> bool:
        """Check if a zone qualifies as an entry zone using runtime configuration."""
        try:
            entry_zones = config_manager.attendance.entry_zone_ids
            if entry_zones:
                return zone_id in entry_zones
        except AttributeError:
            pass
        # Fallback: check against security zones from the zone engine if available
        try:
            from ..security.zone_engine import zone_engine
            zone = zone_engine.get_zone(zone_id)
            if zone:
                return getattr(zone, 'is_entry_zone', False)
        except Exception:
            pass
        # Last resort default — log a warning so operators know this needs config
        import logging
        logging.getLogger("AttendanceRules").warning(
            f"Zone '{zone_id}' checked against hardcoded fallback entry list. "
            "Configure 'entry_zone_ids' in attendance settings."
        )
        return zone_id in ["Z-ENT", "Z3D-LOBBY", "CAM-01-ENTRY"]

    @staticmethod
    def is_exit_zone(zone_id: str) -> bool:
        """Check if a zone qualifies as an exit zone using runtime configuration."""
        try:
            exit_zones = config_manager.attendance.exit_zone_ids
            if exit_zones:
                return zone_id in exit_zones
        except AttributeError:
            pass
        try:
            from ..security.zone_engine import zone_engine
            zone = zone_engine.get_zone(zone_id)
            if zone:
                return getattr(zone, 'is_exit_zone', False)
        except Exception:
            pass
        import logging
        logging.getLogger("AttendanceRules").warning(
            f"Zone '{zone_id}' checked against hardcoded fallback exit list. "
            "Configure 'exit_zone_ids' in attendance settings."
        )
        return zone_id in ["Z-EXIT", "Z-PARKING"]
